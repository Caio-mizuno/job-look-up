import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider } from "./types";

export const API_MODELS = { fast: "claude-haiku-5-5", smart: "claude-sonnet-5-5" } as const;

/** Provedor alternativo: chave da API da Anthropic, roda dentro do container. */
export function createAnthropicProvider(apiKey: string): LlmProvider {
  const client = new Anthropic({ apiKey });
  return {
    id: "anthropic",
    async generate({ tier, system, input, jsonSchema }) {
      const model = API_MODELS[tier];
      const response = await client.messages.create({
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: "user", content: input }],
        output_config: { format: { type: "json_schema", schema: jsonSchema as Record<string, unknown> } },
      });
      if (response.stop_reason === "refusal") throw new Error("a IA recusou a tarefa");
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error("resposta da API sem texto");
      return {
        object: JSON.parse(text.text),
        model,
        usage: {
          inputTokens:
            response.usage.input_tokens +
            (response.usage.cache_creation_input_tokens ?? 0) +
            (response.usage.cache_read_input_tokens ?? 0),
          outputTokens: response.usage.output_tokens,
          costUsd: null,
        },
      };
    },
  };
}
