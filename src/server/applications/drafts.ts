import { z } from "zod";
import type { Db } from "@/server/db/client";
import { generateObject } from "@/server/llm/index";
import { DRAFTS_SYSTEM } from "@/server/llm/prompts";
import { getProfile } from "@/server/profile/repo";
import { withLlmDefer } from "@/server/tasks/llm-defer";
import { enqueue } from "@/server/tasks/queue";
import { buildApplyPayload } from "./payload";
import { getApplication } from "./repo";
import { DraftsSchema, type Drafts } from "./schema";

const neutralize = (s: string) => s.replace(/<\/?vaga/gi, "‹vaga");

async function generateDrafts(db: Db, jobId: number, now: () => number): Promise<Drafts> {
  const job = db.$client.prepare("select title, company, description_text from jobs where id = ?").get(jobId) as
    | { title: string; company: string | null; description_text: string | null }
    | undefined;
  if (!job) throw new Error("vaga não encontrada");
  const p = getProfile(db)?.data;
  const input = [
    `PERFIL:\n${JSON.stringify({ headline: p?.headline, resumo: p?.summary, experiencias: p?.experiences.map((e) => ({ cargo: e.title, empresa: e.company, descricao: e.description.slice(0, 400), tecnologias: e.technologies })) })}`,
    `<vaga>\n${neutralize(job.title)} — ${neutralize(job.company ?? "")}\n${neutralize((job.description_text ?? "").slice(0, 4000))}\n</vaga>`,
  ].join("\n\n");
  return generateObject({ task: "draft_answers", tier: "smart", system: DRAFTS_SYSTEM, input, schema: DraftsSchema }, { db, now });
}

/** Gera (uma vez) os rascunhos e entrega a candidatura para o ajudante. */
export const prepareApplyHandler = withLlmDefer(async (task, { db, now }) => {
  const { applicationId } = z.object({ applicationId: z.number().int() }).parse(task.payload);
  const app = getApplication(db, applicationId);
  if (!app || app.status === "cancelled") return { skipped: true };
  if (!app.drafts) {
    const drafts = await generateDrafts(db, app.jobId, now);
    db.$client.prepare("update applications set drafts = ? where id = ?").run(JSON.stringify(drafts), applicationId);
  }
  const taskId = enqueue(db, { type: "apply", runner: "bridge", payload: buildApplyPayload(db, applicationId) });
  db.$client.prepare("update applications set task_id = ?, status = 'queued' where id = ?").run(taskId, applicationId);
  return { taskId };
});

/** Rascunhos sob demanda para o Kit de candidatura (sem candidatura automática). */
export const draftAnswersHandler = withLlmDefer(async (task, { db, now }) => {
  const { jobId } = z.object({ jobId: z.number().int() }).parse(task.payload);
  return generateDrafts(db, jobId, now);
});
