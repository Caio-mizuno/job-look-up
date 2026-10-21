import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { LlmCapReachedError, LlmInvalidOutputError } from "@/server/llm/errors";
import { generateObject } from "@/server/llm/index";
import type { LlmProvider } from "@/server/llm/types";
import { setSetting } from "@/server/settings";
import { memDb } from "../../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
});

const usage = { inputTokens: 10, outputTokens: 5, costUsd: 0.001 };
function fakeProvider(object: unknown) {
  const calls: unknown[] = [];
  const provider: LlmProvider = {
    id: "claude-code",
    async generate(req) {
      calls.push(req);
      return { object, model: "haiku", usage };
    },
  };
  return { provider, calls };
}

const schema = z.object({ ok: z.boolean() });
const opts = { task: "test" as const, tier: "fast" as const, system: "s", input: "i", schema };

describe("generateObject", () => {
  it("validates output and records usage", async () => {
    const db = memDb();
    const { provider, calls } = fakeProvider({ ok: true });
    await expect(generateObject(opts, { db, provider })).resolves.toEqual({ ok: true });
    const rows = db.$client.prepare("select task, provider, model, input_tokens, output_tokens from llm_usage").all();
    expect(rows).toEqual([{ task: "test", provider: "claude-code", model: "haiku", input_tokens: 10, output_tokens: 5 }]);
    expect((calls[0] as { jsonSchema: { type: string } }).jsonSchema.type).toBe("object");
  });

  it("invalid output → LlmInvalidOutputError and still records usage", async () => {
    const db = memDb();
    const { provider } = fakeProvider({ ok: "sim" });
    await expect(generateObject(opts, { db, provider })).rejects.toBeInstanceOf(LlmInvalidOutputError);
    expect((db.$client.prepare("select count(*) c from llm_usage").get() as { c: number }).c).toBe(1);
  });

  it("cap reached → throws before calling provider", async () => {
    const db = memDb();
    setSetting(db, "llm.dailyCallCap", 1);
    const { provider, calls } = fakeProvider({ ok: true });
    await generateObject(opts, { db, provider });
    await expect(generateObject(opts, { db, provider })).rejects.toBeInstanceOf(LlmCapReachedError);
    expect(calls).toHaveLength(1);
  });

  it("cap 0 means unlimited", async () => {
    const db = memDb();
    const { provider } = fakeProvider({ ok: true });
    for (let i = 0; i < 3; i++) await generateObject(opts, { db, provider });
    expect((db.$client.prepare("select count(*) c from llm_usage").get() as { c: number }).c).toBe(3);
  });
});
