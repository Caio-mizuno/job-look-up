import type { Db } from "@/server/db/client";
import type { TaskRunner, TaskStatus } from "@/server/db/schema";

export type TaskType =
  | "search_run"
  | "generate_queries"
  | "enrich"
  | "extract_profile"
  | "llm_test"
  | "draft_answers"
  | "prepare_apply"
  | "generate_cover_letter"
  | "llm_call"
  | "apply"
  | "browser_fetch";

export type Task = {
  id: number;
  type: TaskType;
  runner: TaskRunner;
  payload: unknown;
  result: unknown;
  status: TaskStatus;
  attempts: number;
  runAt: number;
  lockedAt: number | null;
  error: string | null;
  createdAt: number;
};

export const MAX_ATTEMPTS = 2;
const RETRY_BACKOFF_MS = 30_000;
export const STALE_MS = 600_000;

export class TaskFailedError extends Error {}
export class TaskTimeoutError extends Error {}

type Row = {
  id: number;
  type: string;
  runner: TaskRunner;
  payload: string;
  result: string | null;
  status: TaskStatus;
  attempts: number;
  run_at: number;
  locked_at: number | null;
  error: string | null;
  created_at: number;
};

function toTask(row: Row): Task {
  return {
    id: row.id,
    type: row.type as TaskType,
    runner: row.runner,
    payload: JSON.parse(row.payload),
    result: row.result === null ? null : JSON.parse(row.result),
    status: row.status,
    attempts: row.attempts,
    runAt: row.run_at,
    lockedAt: row.locked_at,
    error: row.error,
    createdAt: row.created_at,
  };
}

export function enqueue(
  db: Db,
  opts: { type: TaskType; runner?: TaskRunner; payload: unknown; runAt?: number },
): number {
  const now = Date.now();
  const res = db.$client
    .prepare(
      "insert into tasks (type, runner, payload, status, attempts, run_at, created_at) values (?, ?, ?, 'queued', 0, ?, ?)",
    )
    .run(opts.type, opts.runner ?? "worker", JSON.stringify(opts.payload ?? null), opts.runAt ?? now, now);
  return Number(res.lastInsertRowid);
}

/** Claim atômico: um único UPDATE … RETURNING evita dois consumidores pegarem a mesma tarefa. */
export function claimNext(
  db: Db,
  opts: { runner: TaskRunner; types?: TaskType[]; now?: number },
): Task | null {
  if (opts.types && opts.types.length === 0) return null;
  const now = opts.now ?? Date.now();
  const typeFilter = opts.types ? `and type in (${opts.types.map(() => "?").join(",")})` : "";
  const row = db.$client
    .prepare(
      `update tasks set status = 'running', locked_at = ?, attempts = attempts + 1
       where id = (
         select id from tasks
         where status = 'queued' and runner = ? and run_at <= ? ${typeFilter}
         order by run_at, id limit 1
       )
       returning *`,
    )
    .get(now, opts.runner, now, ...(opts.types ?? [])) as Row | undefined;
  return row ? toTask(row) : null;
}

export function getTask(db: Db, id: number): Task | null {
  const row = db.$client.prepare("select * from tasks where id = ?").get(id) as Row | undefined;
  return row ? toTask(row) : null;
}

export function completeTask(db: Db, id: number, result: unknown): void {
  db.$client
    .prepare("update tasks set status = 'done', result = ?, locked_at = null, error = null where id = ?")
    .run(JSON.stringify(result ?? null), id);
}

export function failTask(db: Db, id: number, error: string, now = Date.now()): void {
  const task = getTask(db, id);
  if (!task) return;
  if (task.attempts < MAX_ATTEMPTS) {
    db.$client
      .prepare("update tasks set status = 'queued', run_at = ?, locked_at = null, error = ? where id = ?")
      .run(now + RETRY_BACKOFF_MS, error, id);
  } else {
    db.$client.prepare("update tasks set status = 'failed', locked_at = null, error = ? where id = ?").run(error, id);
  }
}

/** Adiar não é falha: devolve a tentativa consumida pelo claim. */
export function deferTask(db: Db, id: number, ms: number, now = Date.now()): void {
  db.$client
    .prepare(
      "update tasks set status = 'queued', run_at = ?, locked_at = null, attempts = max(attempts - 1, 0) where id = ?",
    )
    .run(now + ms, id);
}

export function requeueStale(db: Db, now: number, staleMs = STALE_MS, runner?: TaskRunner): number {
  const runnerFilter = runner ? "and runner = ?" : "";
  const args = runner ? [now - staleMs, runner] : [now - staleMs];
  const failed = db.$client
    .prepare(
      `update tasks set status = 'failed', locked_at = null, error = coalesce(error, 'interrompida')
       where status = 'running' and locked_at <= ? and attempts >= ${MAX_ATTEMPTS} ${runnerFilter}`,
    )
    .run(...args).changes;
  const requeued = db.$client
    .prepare(
      `update tasks set status = 'queued', locked_at = null
       where status = 'running' and locked_at <= ? ${runnerFilter}`,
    )
    .run(...args).changes;
  return failed + requeued;
}

export async function waitForTask(
  db: Db,
  id: number,
  opts: { timeoutMs: number; pollMs?: number },
): Promise<unknown> {
  const pollMs = opts.pollMs ?? 250;
  const deadline = Date.now() + opts.timeoutMs;
  for (;;) {
    const task = getTask(db, id);
    if (!task) throw new TaskFailedError(`tarefa ${id} não existe`);
    if (task.status === "done") return task.result;
    if (task.status === "failed") throw new TaskFailedError(task.error ?? "falhou");
    if (Date.now() >= deadline) throw new TaskTimeoutError(`tarefa ${id} não terminou em ${opts.timeoutMs} ms`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
