import type { Db } from "@/server/db/client";
import { isBridgeOnline } from "@/server/bridge/presence";
import { BridgeOfflineError, waitForBridgeTask } from "@/server/bridge/wait";
import { enqueue } from "@/server/tasks/queue";
import { LlmUnavailableError } from "./errors";
import type { LlmProvider, LlmUsage } from "./types";

const CLI_MODEL = { fast: "haiku", smart: "sonnet" } as const;
// Análise em massa não precisa de raciocínio longo; o tier smart fica no padrão do modelo.
const CLI_EFFORT = { fast: "low", smart: undefined } as const;

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
      const timeoutMs = opts.timeoutMs ?? 300_000;
      let result: { structured: unknown; usage: LlmUsage };
      try {
        result = (await waitForBridgeTask(db, id, now, {
          timeoutMs,
          pollMs: opts.pollMs,
          timeoutMessage: `a IA não respondeu em ${timeoutMs} ms`,
        })) as { structured: unknown; usage: LlmUsage };
      } catch (err) {
        if (err instanceof BridgeOfflineError) throw new LlmUnavailableError(err.message);
        throw err;
      }
      return { object: result.structured, model, usage: result.usage };
    },
  };
}
