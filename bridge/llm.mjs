import { buildLlmArgs, spawnClaude } from "./claude.mjs";

export const LLM_TIMEOUT_MS = 300_000;

const preview = (text) => String(text ?? "").trim().slice(0, 200) || "(sem saída)";

/**
 * Executa uma tarefa `llm_call` e devolve o JSON validado pela CLI.
 * @param {{ model: "haiku" | "sonnet", system: string, input: string, jsonSchema: object }} payload
 * @param {{ spawn?: typeof spawnClaude }} [deps]
 */
export async function runLlmCall(payload, { spawn = spawnClaude } = {}) {
  const args = buildLlmArgs(payload);
  const { stdout, stderr } = await spawn(args, { stdin: payload.input, timeoutMs: LLM_TIMEOUT_MS });

  let out;
  try {
    out = JSON.parse(stdout);
  } catch {
    throw new Error(preview(stdout || stderr));
  }
  if (out.is_error) throw new Error(preview(out.result));
  if (out.structured_output === undefined || out.structured_output === null) {
    throw new Error(`resposta sem structured_output: ${preview(out.result)}`);
  }

  const u = out.usage ?? {};
  return {
    structured: out.structured_output,
    usage: {
      inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      outputTokens: u.output_tokens ?? 0,
      costUsd: typeof out.total_cost_usd === "number" ? out.total_cost_usd : null,
    },
  };
}
