import { describe, expect, it } from "vitest";
import {
  claimNext,
  completeTask,
  deferTask,
  enqueue,
  failTask,
  getTask,
  requeueStale,
  TaskFailedError,
  TaskTimeoutError,
  waitForTask,
} from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

const NOW = 1_000_000;

describe("queue", () => {
  it("claims oldest due task once", () => {
    const db = memDb();
    const a = enqueue(db, { type: "search_run", payload: {}, runAt: 1 });
    const b = enqueue(db, { type: "search_run", payload: {}, runAt: 2 });
    const first = claimNext(db, { runner: "worker", now: NOW });
    expect(first?.id).toBe(a);
    expect(first?.status).toBe("running");
    expect(first?.attempts).toBe(1);
    expect(first?.lockedAt).toBe(NOW);
    expect(claimNext(db, { runner: "worker", now: NOW })?.id).toBe(b);
    expect(claimNext(db, { runner: "worker", now: NOW })).toBeNull();
  });

  it("respects runner and types", () => {
    const db = memDb();
    enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    const s = enqueue(db, { type: "search_run", payload: {}, runAt: 0 });
    const e = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    expect(claimNext(db, { runner: "worker", types: ["enrich"], now: NOW })?.id).toBe(e);
    expect(claimNext(db, { runner: "worker", now: NOW })?.id).toBe(s);
    expect(claimNext(db, { runner: "worker", now: NOW })).toBeNull();
    expect(claimNext(db, { runner: "bridge", now: NOW })?.type).toBe("llm_call");
  });

  it("does not claim future tasks", () => {
    const db = memDb();
    enqueue(db, { type: "enrich", payload: {}, runAt: NOW + 1000 });
    expect(claimNext(db, { runner: "worker", now: NOW })).toBeNull();
  });

  it("returns null for empty types filter", () => {
    const db = memDb();
    enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    expect(claimNext(db, { runner: "worker", types: [], now: NOW })).toBeNull();
  });

  it("failTask requeues then fails at 2 attempts", () => {
    const db = memDb();
    const id = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker", now: NOW });
    failTask(db, id, "boom", NOW);
    let t = getTask(db, id)!;
    expect(t.status).toBe("queued");
    expect(t.runAt).toBeGreaterThanOrEqual(NOW + 30_000);
    claimNext(db, { runner: "worker", now: NOW + 60_000 });
    failTask(db, id, "boom again", NOW + 60_000);
    t = getTask(db, id)!;
    expect(t.status).toBe("failed");
    expect(t.error).toBe("boom again");
  });

  it("deferTask does not consume attempt", () => {
    const db = memDb();
    const id = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker", now: NOW });
    deferTask(db, id, 60_000, NOW);
    const t = getTask(db, id)!;
    expect(t.status).toBe("queued");
    expect(t.attempts).toBe(0);
    expect(t.runAt).toBe(NOW + 60_000);
  });

  it("completeTask stores result", () => {
    const db = memDb();
    const id = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker", now: NOW });
    completeTask(db, id, { ok: true });
    expect(getTask(db, id)).toMatchObject({ status: "done", result: { ok: true } });
  });

  it("requeueStale requeues old running tasks and fails exhausted ones", () => {
    const db = memDb();
    const a = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    const b = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker", now: NOW - 600_001 });
    claimNext(db, { runner: "worker", now: NOW - 600_001 });
    db.$client.prepare("update tasks set attempts = 2 where id = ?").run(b);
    const n = requeueStale(db, NOW);
    expect(n).toBe(2);
    expect(getTask(db, a)?.status).toBe("queued");
    expect(getTask(db, b)?.status).toBe("failed");
  });

  it("requeueStale keeps fresh running tasks", () => {
    const db = memDb();
    const a = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker", now: NOW - 1000 });
    expect(requeueStale(db, NOW)).toBe(0);
    expect(getTask(db, a)?.status).toBe("running");
  });

  it("waitForTask resolves with result", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    claimNext(db, { runner: "bridge", now: NOW });
    setTimeout(() => completeTask(db, id, { structured: { ok: true } }), 30);
    await expect(waitForTask(db, id, { timeoutMs: 1000, pollMs: 10 })).resolves.toEqual({ structured: { ok: true } });
  });

  it("waitForTask rejects when task fails for good", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    db.$client.prepare("update tasks set status = 'failed', error = 'limite' where id = ?").run(id);
    await expect(waitForTask(db, id, { timeoutMs: 1000, pollMs: 10 })).rejects.toBeInstanceOf(TaskFailedError);
  });

  it("waitForTask times out", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    await expect(waitForTask(db, id, { timeoutMs: 50, pollMs: 10 })).rejects.toBeInstanceOf(TaskTimeoutError);
  });
});
