import type { Db } from "@/server/db/client";
import { isBridgeOnline } from "@/server/bridge/presence";
import { enqueue, getTask, TaskFailedError, TaskTimeoutError } from "@/server/tasks/queue";
import { LlmUnavailableError } from "./errors";
import type { LlmProvider, LlmUsage } from "./types";

const CLI_MODEL = { fast: "haiku", smart: "sonnet" } as const;
// Análise em massa não precisa de raciocínio longo; o tier smart fica no padrão do modelo.
const CLI_EFFORT = { fast: "low", smart: undefined } as const;

const failTaskRow = (db: Db, id: number, error: string) =>
  db.$client.prepare("update tasks set status = 'failed', error = ? where id = ? and status in ('queued', 'running')").run(error, id);

/**
 * Espera o resultado, mas desiste cedo se o ajudante sumir antes de pegar a chamada: a tarefa órfã é
 * descartada (não roda depois gastando cota) e o chamador adia a tarefa dele.
 */
async function waitWhileBridgeAlive(
  db: Db,
  id: number,
  now: () => number,
  opts: { timeoutMs?: number; pollMs?: number },
): Promise<unknown> {
  const deadline = Date.now() + (opts.timeoutMs ?? 300_000);
  for (;;) {
    const task = getTask(db, id);
    if (!task) throw new TaskFailedError(`tarefa ${id} não existe`);
    if (task.status === "done") return task.result;
    if (task.status === "failed") throw new TaskFailedError(task.error ?? "falhou");
    if (task.status === "queued" && !isBridgeOnline(db, now())) {
      failTaskRow(db, id, "ajudante desligado");
      throw new LlmUnavailableError("ajudante desligado");
    }
    if (Date.now() >= deadline) {
      failTaskRow(db, id, "tempo esgotado");
      throw new TaskTimeoutError(`a IA não respondeu em ${opts.timeoutMs ?? 300_000} ms`);
    }
    await new Promise((r) => setTimeout(r, opts.pollMs ?? 250));
  }
}

/** Roda a IA pela assinatura do usuário: o ajudante executa `claude -p` no host. */
export function createBridgeProvider(
  db: Db,
  now: () => number,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): LlmProvider {
  return {
    id: "claude-code",
    async generate({ tier, system, input, jsonSchema }) {
      // Sem ajudante não adianta enfileirar: o chamador adia a tarefa inteira.
      if (!isBridgeOnline(db, now())) throw new LlmUnavailableError("ajudante desligado");
      const model = CLI_MODEL[tier];
      const effort = CLI_EFFORT[tier];
      const payload = { model, ...(effort ? { effort } : {}), system, input, jsonSchema };
      const id = enqueue(db, { type: "llm_call", runner: "bridge", payload });
      const result = (await waitWhileBridgeAlive(db, id, now, opts)) as { structured: unknown; usage: LlmUsage };
      return { object: result.structured, model, usage: result.usage };
    },
  };
}
