import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toStrictJsonSchema } from "@/server/llm/json-schema";
import { createOpenAiCompatibleProvider } from "@/server/llm/openai-compatible-provider";

describe("toStrictJsonSchema", () => {
  it("closes nested objects and drops $schema", () => {
    const s = toStrictJsonSchema(
      z.object({ a: z.object({ b: z.string() }), n: z.number().transform((x) => Math.round(x)) }),
    ) as Record<string, unknown>;
    expect(s.$schema).toBeUndefined();
    expect(s.additionalProperties).toBe(false);
    expect((s.properties as Record<string, Record<string, unknown>>).a.additionalProperties).toBe(false);
  });
});

describe("openai-compatible provider", () => {
  it("posts json_schema response_format and parses content", async () => {
    let body: Record<string, unknown> = {};
    let url = "";
    const fetchImpl = (async (u: string, init: RequestInit) => {
      url = u;
      body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 4, completion_tokens: 2 } }),
      );
    }) as unknown as typeof fetch;
    const p = createOpenAiCompatibleProvider({ baseUrl: "http://localhost:11434/v1/", model: "llama3", apiKey: "" }, fetchImpl);
    const res = await p.generate({ tier: "fast", system: "s", input: "i", jsonSchema: { type: "object" } });
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(body.model).toBe("llama3");
    expect((body.response_format as { type: string }).type).toBe("json_schema");
    expect(res).toEqual({ object: { ok: true }, model: "llama3", usage: { inputTokens: 4, outputTokens: 2, costUsd: null } });
  });

  it("surfaces HTTP errors", async () => {
    const fetchImpl = (async () => new Response("modelo não encontrado", { status: 404 })) as unknown as typeof fetch;
    const p = createOpenAiCompatibleProvider({ baseUrl: "http://x/v1", model: "m", apiKey: "" }, fetchImpl);
    await expect(p.generate({ tier: "fast", system: "s", input: "i", jsonSchema: {} })).rejects.toThrow(/404/);
  });
});
