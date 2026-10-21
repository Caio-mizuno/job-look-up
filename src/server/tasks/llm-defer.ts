import { LlmCapReachedError, LlmUnavailableError } from "@/server/llm/errors";
import type { Handler } from "./handlers";
import { deferTask } from "./queue";

export const BRIDGE_RETRY_MS = 60_000;

const nextLocalMidnight = (now: number) => {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
};

/** Ajudante desligado ou teto atingido não são falhas: a tarefa volta para a fila mais tarde. */
export function withLlmDefer(handler: Handler): Handler {
  return async (task, ctx) => {
    try {
      return await handler(task, ctx);
    } catch (err) {
      const now = ctx.now();
      if (err instanceof LlmUnavailableError) {
        deferTask(ctx.db, task.id, BRIDGE_RETRY_MS, now);
        return { deferred: true };
      }
      if (err instanceof LlmCapReachedError) {
        deferTask(ctx.db, task.id, nextLocalMidnight(now) - now, now);
        return { deferred: true };
      }
      throw err;
    }
  };
}
