import type { Db } from "@/server/db/client";
import { isBridgeOnline } from "@/server/bridge/presence";
import { enqueue, waitForTask } from "@/server/tasks/queue";
import { LlmUnavailableError } from "./errors";
import type { LlmProvider, LlmUsage } from "./types";

const CLI_MODEL = { fast: "haiku", smart: "sonnet" } as const;

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
      const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: { model, system, input, jsonSchema } });
      const result = (await waitForTask(db, id, {
        timeoutMs: opts.timeoutMs ?? 300_000,
        pollMs: opts.pollMs ?? 250,
      })) as { structured: unknown; usage: LlmUsage };
      return { object: result.structured, model, usage: result.usage };
    },
  };
}
