"use server";

import { z } from "zod";
import { buildCompanyMessage } from "@/server/applications/message";
import { applyJobs, queueApplication } from "@/server/applications/repo";
import { getDb } from "@/server/db/client";
import { restoreDiscarded, setJobStatus } from "@/server/jobs/list";
import { getMailConfig } from "@/server/outreach/config";
import { getOutreachDraft, sendOutreachEmail, type OutreachDraft, type SendResult } from "@/server/outreach/send";
import { getProfile } from "@/server/profile/repo";
import { enqueue } from "@/server/tasks/queue";

/** Reanalisa uma vaga (botão "Recalcular" / "Tentar de novo" no card). */
export async function recalcJob(id: number): Promise<void> {
  const db = getDb();
  db.$client.prepare("update jobs set analysis_error = null where id = ?").run(id);
  enqueue(db, { type: "enrich", payload: { jobIds: [id] } });
}

export async function markSeen(id: number): Promise<void> {
  const db = getDb();
  // Só sai de "nova"; interesse/candidatura não voltam para "vista".
  const row = db.$client.prepare("select status from jobs where id = ?").get(id) as { status: string } | undefined;
  if (row?.status === "new") setJobStatus(db, id, "seen", Date.now());
}

export async function discardJob(id: number): Promise<void> {
  setJobStatus(getDb(), id, "discarded", Date.now());
}

export async function restoreJob(id: number): Promise<void> {
  setJobStatus(getDb(), id, "seen", Date.now());
}

/** "Limpar cache" das descartadas; devolve quantas voltaram. */
export async function clearDiscardedCache(): Promise<number> {
  return restoreDiscarded(getDb());
}

/** "Quero participar": cria a candidatura ou repete a última que falhou/pediu login. */
export async function applyToJob(jobId: number): Promise<{ ok: true; id: number } | { ok: false; error: "linkedin" | "not_found" }> {
  return queueApplication(getDb(), jobId, Date.now());
}

/** "Quero participar" em lote: enfileira as elegíveis e conta as puladas. */
export async function applyToJobs(jobIds: number[]): Promise<ReturnType<typeof applyJobs>> {
  return applyJobs(getDb(), jobIds, Date.now());
}

export async function generateDrafts(jobId: number): Promise<{ taskId: number }> {
  return { taskId: enqueue(getDb(), { type: "draft_answers", payload: { jobId } }) };
}

export type KitData = {
  jobTitle: string;
  jobUrl: string;
  fields: { label: string; value: string }[];
  answers: { question: string; answer: string }[];
  drafts: { pitch: string; whyCompany: string; message?: string } | null;
  /** Mensagem genérica (sem IA), usada quando ainda não há uma gerada. */
  message: string;
};

export async function getKitData(jobId: number): Promise<KitData | null> {
  const db = getDb();
  const job = db.$client.prepare("select title, url, company from jobs where id = ?").get(jobId) as
    | { title: string; url: string; company: string | null }
    | undefined;
  if (!job) return null;
  const p = getProfile(db)?.data;
  const d = db.$client
    .prepare("select drafts from applications where job_id = ? and drafts is not null order by id desc limit 1")
    .get(jobId) as { drafts: string } | undefined;
  const lastJob = p?.experiences.find((e) => e.end === null) ?? p?.experiences[0];
  const fields = p
    ? [
        { label: "Nome", value: p.personal.name },
        { label: "E-mail", value: p.personal.email },
        { label: "Telefone", value: p.personal.phone },
        { label: "Cidade", value: [p.personal.city, p.personal.state].filter(Boolean).join(" - ") },
        { label: "LinkedIn", value: p.personal.linkedin },
        { label: "GitHub", value: p.personal.github },
        { label: "Portfólio", value: p.personal.portfolio },
        { label: "Título profissional", value: p.headline },
        { label: "Resumo", value: p.summary },
        { label: "Cargo atual", value: lastJob ? `${lastJob.title} — ${lastJob.company}` : "" },
        { label: "Habilidades", value: p.skills.map((s) => s.name).join(", ") },
      ]
    : [];
  return {
    jobTitle: job.title,
    jobUrl: job.url,
    fields,
    answers: (p?.readyAnswers ?? []).filter((a) => a.answer.trim()),
    drafts: d ? JSON.parse(d.drafts) : null,
    message: buildCompanyMessage({
      name: p?.personal.name ?? "",
      headline: p?.headline ?? "",
      skills: p?.skills.map((s) => s.name) ?? [],
      jobTitle: job.title,
      company: job.company,
      linkedin: p?.personal.linkedin ?? "",
    }),
  };
}

/** Rascunho do diálogo "Enviar e-mail" (posts do LinkedIn) e se o SMTP está configurado. */
export async function loadOutreachDraft(
  jobId: number,
): Promise<{ draft: OutreachDraft; cvFilename: string | null; sentAt: number | null; configured: boolean } | null> {
  const res = getOutreachDraft(getDb(), jobId);
  return res ? { ...res, configured: getMailConfig() !== null } : null;
}

const DraftInput = z.object({
  to: z.string().trim().max(320),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(10_000),
});

/** Envia o e-mail revisado no diálogo. Só roda pelo clique em "Enviar". */
export async function sendOutreach(jobId: number, draft: OutreachDraft): Promise<SendResult> {
  const parsed = DraftInput.safeParse(draft);
  if (!Number.isInteger(jobId) || !parsed.success) return { ok: false, error: "invalid_to" };
  return sendOutreachEmail(getDb(), jobId, parsed.data, { config: getMailConfig(), now: Date.now() });
}
