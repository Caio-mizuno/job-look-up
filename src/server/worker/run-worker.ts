import type { Db } from "@/server/db/client";
import type { Handler } from "@/server/tasks/handlers";
import { claimNext, completeTask, failTask, type TaskType } from "@/server/tasks/queue";

export type WorkerOptions = {
  db: Db;
  handlers: Partial<Record<TaskType, Handler>>;
  concurrency?: number;
  pollMs?: number;
  tick?: (db: Db, now: number) => void;
  tickMs?: number;
};

export function startWorker(opts: WorkerOptions): () => Promise<void> {
  const { db, handlers } = opts;
  const concurrency = opts.concurrency ?? 4;
  const pollMs = opts.pollMs ?? 500;
  const types = Object.keys(handlers) as TaskType[];
  const inFlight = new Set<Promise<void>>();
  let stopped = false;

  const run = async (task: NonNullable<ReturnType<typeof claimNext>>) => {
    const handler = handlers[task.type];
    try {
      if (!handler) throw new Error(`sem handler para ${task.type}`);
      const result = await handler(task, { db, now: Date.now });
      // Handler pode ter adiado/reagendado a própria tarefa; só completa se continua rodando.
      const current = db.$client.prepare("select status from tasks where id = ?").get(task.id) as
        | { status: string }
        | undefined;
      if (current?.status === "running") completeTask(db, task.id, result);
    } catch (err) {
      failTask(db, task.id, err instanceof Error ? err.message : String(err));
    }
  };

  const poll = () => {
    if (stopped) return;
    while (inFlight.size < concurrency) {
      const task = claimNext(db, { runner: "worker", types });
      if (!task) break;
      const p = run(task).finally(() => inFlight.delete(p));
      inFlight.add(p);
    }
  };

  const pollTimer = setInterval(poll, pollMs);
  poll();
  const tickTimer = opts.tick
    ? setInterval(() => {
        try {
          opts.tick?.(db, Date.now());
        } catch (err) {
          console.error("[worker] tick falhou:", err);
        }
      }, opts.tickMs ?? 60_000)
    : null;

  return async () => {
    stopped = true;
    clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    await Promise.allSettled([...inFlight]);
  };
}
