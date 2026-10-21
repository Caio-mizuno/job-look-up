import type { OpenAiCompatibleConfig } from "@/server/settings";
import type { LlmProvider } from "./types";

/** Ollama, OpenRouter, OpenAI: qualquer endpoint /chat/completions com json_schema. */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
  fetchImpl: typeof fetch = fetch,
): LlmProvider {
  return {
    id: "openai-compatible",
    async generate({ system, input, jsonSchema }) {
      const res = await fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: input },
          ],
          response_format: { type: "json_schema", json_schema: { name: "output", schema: jsonSchema, strict: true } },
        }),
      });
      if (!res.ok) throw new Error(`provedor respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("provedor devolveu resposta vazia");
      return {
        object: JSON.parse(content),
        model: config.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          costUsd: null,
        },
      };
    },
  };
}
