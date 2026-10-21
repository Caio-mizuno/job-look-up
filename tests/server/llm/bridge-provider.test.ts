import { beforeEach, describe, expect, it } from "vitest";
import { touchBridge } from "@/server/bridge/presence";
import { createBridgeProvider } from "@/server/llm/bridge-provider";
import { LlmUnavailableError } from "@/server/llm/errors";
import { claimNext, completeTask, getTask } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
});

const req = { tier: "fast" as const, system: "s", input: "i", jsonSchema: { type: "object" } };

describe("bridge provider", () => {
  it("offline → LlmUnavailableError, no task enqueued", async () => {
    const db = memDb();
    const provider = createBridgeProvider(db, () => Date.now());
    await expect(provider.generate(req)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect((db.$client.prepare("select count(*) c from tasks").get() as { c: number }).c).toBe(0);
  });

  it("online → enqueues llm_call haiku for fast and resolves", async () => {
    const db = memDb();
    touchBridge(db, Date.now());
    const provider = createBridgeProvider(db, () => Date.now(), { pollMs: 10 });
    const pending = provider.generate(req);
    await new Promise((r) => setTimeout(r, 20));
    const task = claimNext(db, { runner: "bridge", types: ["llm_call"] })!;
    expect(task.payload).toEqual({ model: "haiku", system: "s", input: "i", jsonSchema: { type: "object" } });
    completeTask(db, task.id, { structured: { ok: true }, usage: { inputTokens: 3, outputTokens: 2, costUsd: 0 } });
    await expect(pending).resolves.toEqual({
      object: { ok: true },
      model: "haiku",
      usage: { inputTokens: 3, outputTokens: 2, costUsd: 0 },
    });
    expect(getTask(db, task.id)?.status).toBe("done");
  });

  it("uses sonnet for smart tier", async () => {
    const db = memDb();
    touchBridge(db, Date.now());
    const provider = createBridgeProvider(db, () => Date.now(), { pollMs: 10, timeoutMs: 50 });
    const pending = provider.generate({ ...req, tier: "smart" }).catch((e) => e);
    await new Promise((r) => setTimeout(r, 20));
    const row = db.$client.prepare("select payload from tasks").get() as { payload: string };
    expect(JSON.parse(row.payload).model).toBe("sonnet");
    await pending;
  });
});
