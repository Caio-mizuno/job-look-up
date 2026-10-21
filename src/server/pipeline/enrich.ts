import { z } from "zod";
import type { Db } from "@/server/db/client";
import { ContractEnum, WorkModelEnum, type Contract, type WorkModel } from "@/server/domain/enums";
import { LlmCapReachedError, LlmUnavailableError } from "@/server/llm/errors";
import { generateObject } from "@/server/llm/index";
import { ENRICH_SYSTEM } from "@/server/llm/prompts";
import { getProfile } from "@/server/profile/repo";
import type { Profile } from "@/server/profile/schema";
import { withLlmDefer } from "@/server/tasks/llm-defer";
import { enqueue, MAX_ATTEMPTS } from "@/server/tasks/queue";

export const MAX_DESCRIPTION_CHARS = 6_000;

export const EnrichmentSchema = z.object({
  jobId: z.number().int(),
  matchScore: z.number().transform((n) => Math.max(0, Math.min(100, Math.round(n)))),
  why: z.string(),
  gaps: z.array(z.string()),
  summary: z.string(),
  offers: z.array(z.string()),
  responsibilities: z.array(z.string()),
  requirements: z.array(z.object({ text: z.string(), mustHave: z.boolean() })),
  workModel: WorkModelEnum.nullable(),
  contract: ContractEnum.nullable(),
  salary: z.string().nullable(),
});
export const BatchEnrichmentSchema = z.object({ results: z.array(EnrichmentSchema) });
export type Enrichment = z.infer<typeof EnrichmentSchema>;

export type JobRow = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  workModel: WorkModel | null;
  contract: Contract | null;
  salaryText: string | null;
  descriptionText: string | null;
};

/** Texto de terceiros não pode fechar nem abrir o delimitador. */
const neutralize = (s: string) => s.replace(/<\/vaga/gi, "<\\/vaga").replace(/<vaga/gi, "<\\vaga");

function profileSummary(p: Profile): string {
  return JSON.stringify({
    headline: p.headline,
    resumo: p.summary.slice(0, 1200),
    habilidades: p.skills.map((s) => (s.years ? `${s.name} (${s.years} anos)` : s.name)),
    experiencias: p.experiences.map((e) => ({
      cargo: e.title,
      empresa: e.company,
      periodo: `${e.start || "?"} – ${e.end ?? "atual"}`,
      tecnologias: e.technologies,
    })),
    idiomas: p.languages,
    procura: p.preferences,
  });
}

export function buildEnrichInput(profile: Profile, jobs: JobRow[]): string {
  const parts = [`PERFIL:\n${profileSummary(profile)}\n\nVAGAS:`];
  for (const j of jobs) {
    const meta = [j.company, j.location, j.workModel, j.contract, j.salaryText].filter(Boolean).join(" · ");
    const desc = (j.descriptionText ?? "(sem descrição)").slice(0, MAX_DESCRIPTION_CHARS);
    parts.push(`<vaga id="${j.id}">\n${neutralize(j.title)}${meta ? `\n${neutralize(meta)}` : ""}\n---\n${neutralize(desc)}\n</vaga>`);
  }
  return parts.join("\n\n");
}

const Payload = z.object({ jobIds: z.array(z.number().int()).min(1), retry: z.boolean().optional() });

type Row = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  work_model: WorkModel | null;
  contract: Contract | null;
  salary_text: string | null;
  description_text: string | null;
};

function loadPending(db: Db, ids: number[], version: string): JobRow[] {
  if (ids.length === 0) return [];
  const rows = db.$client
    .prepare(
      `select id, title, company, location, work_model, contract, salary_text, description_text from jobs
       where id in (${ids.map(() => "?").join(",")})
         and id not in (select job_id from job_enrichment where profile_version = ?)`,
    )
    .all(...ids, version) as Row[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location,
    workModel: r.work_model,
    contract: r.contract,
    salaryText: r.salary_text,
    descriptionText: r.description_text,
  }));
}

export const enrichHandler = withLlmDefer(async (task, { db, now }) => {
  const { jobIds, retry } = Payload.parse(task.payload);
  const profile = getProfile(db);
  if (!profile) return { skipped: "sem perfil" };
  const jobs = loadPending(db, jobIds, profile.version);
  if (jobs.length === 0) return { skipped: "já analisadas" };

  let results: Enrichment[];
  try {
    ({ results } = await generateObject(
      { task: "enrich", tier: "fast", system: ENRICH_SYSTEM, input: buildEnrichInput(profile.data, jobs), schema: BatchEnrichmentSchema },
      { db, now },
    ));
  } catch (err) {
    // Ajudante desligado/teto: o withLlmDefer adia. Qualquer outro erro na última tentativa vira
    // "análise falhou" com o motivo (limite do plano, timeout, saída inválida), nunca "analisando…" eterno.
    const deferrable = err instanceof LlmUnavailableError || err instanceof LlmCapReachedError;
    if (!deferrable && task.attempts >= MAX_ATTEMPTS) {
      const reason = err instanceof Error ? err.message : String(err);
      const mark = db.$client.prepare("update jobs set analysis_error = ? where id = ?");
      for (const j of jobs) mark.run(`análise falhou: ${reason}`.slice(0, 160), j.id);
      return { failed: true };
    }
    throw err;
  }

  const wanted = new Set(jobs.map((j) => j.id));
  const insert = db.$client.prepare(
    `insert into job_enrichment (job_id, profile_version, match_score, data, model, created_at) values (?, ?, ?, ?, ?, ?)
     on conflict(job_id, profile_version) do update set match_score = excluded.match_score, data = excluded.data,
       model = excluded.model, created_at = excluded.created_at`,
  );
  const clear = db.$client.prepare("update jobs set analysis_error = null where id = ?");
  const model = "haiku";
  const done = new Set<number>();
  for (const r of results) {
    if (!wanted.has(r.jobId) || done.has(r.jobId)) continue;
    const { jobId, matchScore, ...data } = r;
    insert.run(jobId, profile.version, matchScore, JSON.stringify(data), model, now());
    clear.run(jobId);
    done.add(jobId);
  }

  const missing = jobs.map((j) => j.id).filter((id) => !done.has(id));
  if (missing.length > 0 && !retry) enqueue(db, { type: "enrich", payload: { jobIds: missing, retry: true } });
  return { enriched: done.size, missing: missing.length };
});
