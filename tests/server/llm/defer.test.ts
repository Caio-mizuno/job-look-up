import { describe, expect, it } from "vitest";
import { LlmCapReachedError, LlmUnavailableError } from "@/server/llm/errors";
import { withLlmDefer } from "@/server/tasks/llm-defer";
import { claimNext, enqueue, getTask } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

describe("withLlmDefer", () => {
  it("defers 60s on unavailable without consuming attempt", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    const task = claimNext(db, { runner: "worker", now: 1000 })!;
    const handler = withLlmDefer(async () => {
      throw new LlmUnavailableError("offline");
    });
    await expect(handler(task, { db, now: () => 1000 })).resolves.toEqual({ deferred: true });
    expect(getTask(db, id)).toMatchObject({ status: "queued", attempts: 0, runAt: 61_000 });
  });

  it("defers until next local midnight on cap", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    const now = new Date(2026, 9, 21, 15, 30).getTime();
    const task = claimNext(db, { runner: "worker", now })!;
    const handler = withLlmDefer(async () => {
      throw new LlmCapReachedError("cap");
    });
    await handler(task, { db, now: () => now });
    expect(getTask(db, id)?.runAt).toBe(new Date(2026, 9, 22, 0, 0).getTime());
  });

  it("rethrows other errors", async () => {
    const db = memDb();
    enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    const task = claimNext(db, { runner: "worker" })!;
    const handler = withLlmDefer(async () => {
      throw new Error("outro");
    });
    await expect(handler(task, { db, now: Date.now })).rejects.toThrow("outro");
  });
});
