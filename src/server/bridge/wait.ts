import type { Db } from "@/server/db/client";
import { getTask, TaskFailedError, TaskTimeoutError } from "@/server/tasks/queue";
import { isBridgeOnline } from "./presence";

export class BridgeOfflineError extends Error {}

const failTaskRow = (db: Db, id: number, error: string) =>
  db.$client.prepare("update tasks set status = 'failed', error = ? where id = ? and status in ('queued', 'running')").run(error, id);

/**
 * Espera o resultado, mas desiste cedo se o ajudante sumir antes de pegar a tarefa: a tarefa órfã é
 * descartada (não roda depois à toa) e o chamador decide o que fazer.
 */
export async function waitForBridgeTask(
  db: Db,
  id: number,
  now: () => number,
  opts: { timeoutMs: number; pollMs?: number; timeoutMessage: string },
): Promise<unknown> {
  const deadline = Date.now() + opts.timeoutMs;
  for (;;) {
    const task = getTask(db, id);
    if (!task) throw new TaskFailedError(`tarefa ${id} não existe`);
    if (task.status === "done") return task.result;
    if (task.status === "failed") throw new TaskFailedError(task.error ?? "falhou");
    if (task.status === "queued" && !isBridgeOnline(db, now())) {
      failTaskRow(db, id, "ajudante desligado");
      throw new BridgeOfflineError("ajudante desligado");
    }
    if (Date.now() >= deadline) {
      failTaskRow(db, id, "tempo esgotado");
      throw new TaskTimeoutError(opts.timeoutMessage);
    }
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 250));
  }
}
