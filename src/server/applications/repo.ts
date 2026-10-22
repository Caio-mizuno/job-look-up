import type { Db } from "@/server/db/client";
import type { ApplicationStatus } from "@/server/db/schema";
import { getProfile, saveProfile } from "@/server/profile/repo";
import { enqueue } from "@/server/tasks/queue";
import { isAutoApplyAllowed } from "@/lib/apply-url";
import { BULK_APPLY_MAX, type BulkSkipReason } from "@/lib/bulk-apply";
import type { ApplyEvent, ApplyReport, Drafts, ExtraAnswer } from "./schema";

const MAX_EVENTS = 500;
const MAX_EVENT_TEXT = 2000;

export type Application = {
  id: number;
  jobId: number;
  status: ApplicationStatus;
  taskId: number | null;
  drafts: Drafts | null;
  extraAnswers: ExtraAnswer[];
  events: ApplyEvent[];
  report: ApplyReport | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
};

export type ApplicationRow = {
  id: number;
  job_id: number;
  status: ApplicationStatus;
  task_id: number | null;
  drafts: string | null;
  extra_answers: string;
  events: string;
  report: string | null;
  error: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
};

export function toApplication(r: ApplicationRow): Application {
  return {
    id: r.id,
    jobId: r.job_id,
    status: r.status,
    taskId: r.task_id,
    drafts: r.drafts ? JSON.parse(r.drafts) : null,
    extraAnswers: JSON.parse(r.extra_answers),
    events: JSON.parse(r.events),
    report: r.report ? JSON.parse(r.report) : null,
    error: r.error,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  };
}

export function getApplication(db: Db, id: number): Application | null {
  const row = db.$client.prepare("select * from applications where id = ?").get(id) as ApplicationRow | undefined;
  return row ? toApplication(row) : null;
}

export function getApplicationByTask(db: Db, taskId: number): Application | null {
  const row = db.$client.prepare("select * from applications where task_id = ?").get(taskId) as ApplicationRow | undefined;
  return row ? toApplication(row) : null;
}

export function createApplication(db: Db, jobId: number, now: number): { id: number } | { error: "linkedin" | "not_found" } {
  const job = db.$client.prepare("select url from jobs where id = ?").get(jobId) as { url: string } | undefined;
  if (!job) return { error: "not_found" };
  if (!isAutoApplyAllowed(job.url)) return { error: "linkedin" };
  const res = db.$client
    .prepare("insert into applications (job_id, status, created_at) values (?, 'queued', ?)")
    .run(jobId, now);
  const id = Number(res.lastInsertRowid);
  db.$client.prepare("update jobs set status = 'interested' where id = ? and status not in ('applied')").run(jobId);
  linkPrepareTask(db, id);
  return { id };
}

/** "Quero participar": repete a última candidatura que falhou/pediu login ou cria uma nova. */
export function queueApplication(db: Db, jobId: number, now: number): { ok: true; id: number } | { ok: false; error: "linkedin" | "not_found" } {
  const last = db.$client
    .prepare("select id from applications where job_id = ? and status in ('failed', 'login_required') order by id desc limit 1")
    .get(jobId) as { id: number } | undefined;
  if (last) {
    retryApplication(db, last.id, now);
    return { ok: true, id: last.id };
  }
  const res = createApplication(db, jobId, now);
  return "id" in res ? { ok: true, id: res.id } : { ok: false, error: res.error };
}

/** Status em que a vaga já tem candidatura viva ou concluída: o lote não cria outra. */
const ACTIVE = new Set<ApplicationStatus>(["queued", "running", "needs_review", "submitted"]);

/** Lote do "Quero participar": cada vaga segue o mesmo caminho do botão individual. */
export function applyJobs(
  db: Db,
  jobIds: number[],
  now: number,
): { queued: number[]; skipped: { jobId: number; reason: BulkSkipReason }[] } {
  const unique = [...new Set(jobIds)];
  const queued: number[] = [];
  const skipped: { jobId: number; reason: BulkSkipReason }[] = [];
  const latestStatus = db.$client.prepare(
    "select status from applications where job_id = ? and status != 'cancelled' order by created_at desc, id desc limit 1",
  );
  db.$client.transaction(() => {
    for (const jobId of unique.slice(0, BULK_APPLY_MAX)) {
      const app = latestStatus.get(jobId) as { status: ApplicationStatus } | undefined;
      if (app && ACTIVE.has(app.status)) {
        skipped.push({ jobId, reason: "active" });
        continue;
      }
      const res = queueApplication(db, jobId, now);
      if (res.ok) queued.push(jobId);
      else skipped.push({ jobId, reason: res.error });
    }
  })();
  for (const jobId of unique.slice(BULK_APPLY_MAX)) skipped.push({ jobId, reason: "limit" });
  return { queued, skipped };
}

/** A candidatura aponta sempre para a tarefa em curso (prepare_apply e depois apply): o sync acompanha falhas das duas. */
function linkPrepareTask(db: Db, id: number): void {
  const taskId = enqueue(db, { type: "prepare_apply", payload: { applicationId: id } });
  db.$client.prepare("update applications set task_id = ? where id = ?").run(taskId, id);
}

export function appendEvents(db: Db, id: number, events: ApplyEvent[]): void {
  const app = getApplication(db, id);
  if (!app) return;
  const incoming = events.slice(0, 200).map((e) => ({ ...e, text: e.text.slice(0, MAX_EVENT_TEXT) }));
  const all = [...app.events, ...incoming].slice(-MAX_EVENTS);
  db.$client.prepare("update applications set events = ? where id = ?").run(JSON.stringify(all), id);
}

const REPORT_STATUS: Record<ApplyReport["status"], ApplicationStatus> = {
  submitted: "submitted",
  needs_review: "needs_review",
  login_required: "login_required",
  blocked: "failed",
  error: "failed",
};

export function applyReport(db: Db, id: number, report: ApplyReport, now: number): void {
  const status = REPORT_STATUS[report.status];
  db.$client
    .prepare("update applications set status = ?, report = ?, error = ?, finished_at = ? where id = ? and status != 'cancelled'")
    .run(status, JSON.stringify(report), status === "failed" ? report.notes || report.status : null, now, id);
  // Enviada pelo ajudante: a vaga sai de "interessado" como no "Marquei como enviada".
  if (status === "submitted") {
    db.$client
      .prepare("update jobs set status = 'applied' where id = (select job_id from applications where id = ? and status = 'submitted')")
      .run(id);
  }
}

export function failApplication(db: Db, id: number, error: string, now: number): void {
  db.$client
    .prepare("update applications set status = 'failed', error = ?, finished_at = ? where id = ? and status != 'cancelled'")
    .run(error, now, id);
}

/** Respostas dadas no app: valem para a próxima tentativa e, se pedido, viram respostas prontas. */
export function answerUnanswered(db: Db, id: number, answers: ExtraAnswer[], now: number): void {
  const app = getApplication(db, id);
  if (!app) return;
  const byQ = new Map(app.extraAnswers.map((a) => [a.question.trim().toLowerCase(), a]));
  for (const a of answers) byQ.set(a.question.trim().toLowerCase(), { question: a.question.trim(), answer: a.answer });
  db.$client.prepare("update applications set extra_answers = ? where id = ?").run(JSON.stringify([...byQ.values()]), id);

  const toSave = answers.filter((a) => a.saveAsReady && a.answer.trim());
  const profile = getProfile(db);
  if (toSave.length === 0 || !profile) return;
  const ready = [...profile.data.readyAnswers];
  for (const a of toSave) {
    const i = ready.findIndex((r) => r.question.trim().toLowerCase() === a.question.trim().toLowerCase());
    if (i >= 0) ready[i] = { question: ready[i].question, answer: a.answer };
    else ready.push({ question: a.question.trim(), answer: a.answer });
  }
  saveProfile(db, { ...profile.data, readyAnswers: ready }, now);
}

export function retryApplication(db: Db, id: number, _now: number): void {
  db.$client
    .prepare("update applications set status = 'queued', error = null, report = null, started_at = null, finished_at = null where id = ?")
    .run(id);
  linkPrepareTask(db, id);
}

/** Cancela de verdade: a tarefa ainda na fila nunca chega ao ajudante. Uma já em execução termina sem mudar o status. */
export function cancelApplication(db: Db, id: number): void {
  db.$client
    .prepare(
      `update tasks set status = 'failed', error = 'cancelada'
       where status = 'queued' and id = (select task_id from applications where id = ?)`,
    )
    .run(id);
  db.$client.prepare("update applications set status = 'cancelled' where id = ?").run(id);
}

export function markSubmitted(db: Db, id: number, now: number): void {
  const app = getApplication(db, id);
  if (!app) return;
  db.$client.prepare("update applications set status = 'submitted', finished_at = ? where id = ?").run(now, id);
  db.$client.prepare("update jobs set status = 'applied' where id = ?").run(app.jobId);
}
