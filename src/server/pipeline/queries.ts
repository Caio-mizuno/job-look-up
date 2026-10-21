import { z } from "zod";
import { isUsableKeywords } from "@/lib/search-keywords";
import type { Db } from "@/server/db/client";
import { generateObject } from "@/server/llm/index";
import { GENERATE_QUERIES_SYSTEM } from "@/server/llm/prompts";
import { getProfile } from "@/server/profile/repo";
import type { Profile } from "@/server/profile/schema";
import type { SearchQuery } from "@/server/sources/types";
import type { Handler } from "@/server/tasks/handlers";
import { startSearchRun } from "./search-run";

export const MAX_QUERIES = 6;

const QueriesSchema = z.object({
  queries: z
    .array(z.object({ keywords: z.string().min(2), location: z.string().nullable() }))
    .min(1)
    .max(MAX_QUERIES),
});

function dedupe(queries: SearchQuery[]): SearchQuery[] {
  const seen = new Set<string>();
  const out: SearchQuery[] = [];
  for (const q of queries) {
    const keywords = q.keywords.replace(/\s+/g, " ").trim();
    const key = `${keywords.toLowerCase()}|${(q.location ?? "").toLowerCase()}`;
    if (!keywords || !isUsableKeywords(keywords) || seen.has(key)) continue;
    seen.add(key);
    out.push({ keywords, location: q.location?.trim() || null });
  }
  return out.slice(0, MAX_QUERIES);
}

/** Sem IA: cargos-alvo × principal habilidade. */
export function fallbackQueries(profile: Profile): SearchQuery[] {
  const location = profile.preferences.locations[0] ?? null;
  const roles = [...new Set(profile.preferences.roles.map((r) => r.trim()).filter(Boolean))];
  const base = roles.length > 0 ? roles : [profile.headline.trim()].filter(Boolean);
  const topSkill = profile.skills[0]?.name.trim() ?? profile.experiences[0]?.technologies[0]?.trim();
  const queries: SearchQuery[] = base.slice(0, 3).map((keywords) => ({ keywords, location }));
  if (base[0] && topSkill) queries.push({ keywords: `${base[0]} ${topSkill}`, location });
  if (queries.length === 0 && topSkill) queries.push({ keywords: topSkill, location });
  return dedupe(queries);
}

export function listQueries(db: Db): (SearchQuery & { origin: "ai" | "user" })[] {
  return db.$client
    .prepare("select keywords, location, origin from search_queries where enabled = 1 order by id")
    .all() as (SearchQuery & { origin: "ai" | "user" })[];
}

function replaceQueries(db: Db, queries: SearchQuery[], origin: "ai" | "user", now: number) {
  const insert = db.$client.prepare(
    "insert into search_queries (keywords, location, origin, enabled, created_at) values (?, ?, ?, 1, ?)",
  );
  db.$client.transaction(() => {
    db.$client.prepare(origin === "user" ? "delete from search_queries" : "delete from search_queries where origin = 'ai'").run();
    for (const q of dedupe(queries)) insert.run(q.keywords, q.location, origin, now);
  })();
}

/** Consultas editadas pela pessoa substituem todas e não são mais sobrescritas pela IA. */
export function saveQueries(db: Db, queries: SearchQuery[], now: number): void {
  replaceQueries(db, queries, "user", now);
}

export function clearQueries(db: Db): void {
  db.$client.prepare("delete from search_queries").run();
}

function profileForPrompt(p: Profile): string {
  return JSON.stringify({
    headline: p.headline,
    cargos: p.preferences.roles,
    senioridades: p.preferences.seniorities,
    modelos: p.preferences.workModels,
    cidades: p.preferences.locations,
    habilidades: p.skills.map((s) => s.name),
    experiencias: p.experiences.map((e) => ({ cargo: e.title, tecnologias: e.technologies })),
  });
}

export const generateQueriesHandler: Handler = async (_task, { db, now }) => {
  const profile = getProfile(db)?.data;
  if (!profile) return { skipped: "sem perfil" };
  const hasUserQueries = listQueries(db).some((q) => q.origin === "user" && isUsableKeywords(q.keywords));
  let fallback = false;

  if (!hasUserQueries) {
    try {
      const { queries } = await generateObject(
        { task: "generate_queries", tier: "smart", system: GENERATE_QUERIES_SYSTEM, input: profileForPrompt(profile), schema: QueriesSchema },
        { db, now },
      );
      replaceQueries(db, queries, "ai", now());
    } catch {
      // Busca não espera pela IA: sem ajudante (ou com erro), vale a regra simples.
      fallback = true;
      replaceQueries(db, fallbackQueries(profile), "ai", now());
    }
  }

  const runId = startSearchRun(db, "manual", now());
  return { runId, fallback };
};
