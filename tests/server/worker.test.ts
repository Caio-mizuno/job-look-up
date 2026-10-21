import { describe, expect, it } from "vitest";
import { enqueue, getTask } from "@/server/tasks/queue";
import { startWorker } from "@/server/worker/run-worker";
import { memDb } from "../helpers/db";

async function until(cond: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("startWorker", () => {
  it("runs handler and completes", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "llm_test", payload: { x: 1 }, runAt: 0 });
    const stop = startWorker({ db, handlers: { llm_test: async (t) => ({ echo: t.payload }) }, pollMs: 10 });
    await until(() => getTask(db, id)?.status === "done");
    await stop();
    expect(getTask(db, id)?.result).toEqual({ echo: { x: 1 } });
  });

  it("handler throw → failTask", async () => {
    const db = memDb();
    const id = enqueue(db, { type: "llm_test", payload: {}, runAt: 0 });
    const stop = startWorker({
      db,
      handlers: {
        llm_test: async () => {
          throw new Error("quebrou");
        },
      },
      pollMs: 10,
    });
    await until(() => getTask(db, id)?.error === "quebrou");
    await stop();
    expect(getTask(db, id)?.status).toBe("queued");
    expect(getTask(db, id)?.attempts).toBe(1);
  });

  it("only claims types with handlers", async () => {
    const db = memDb();
    const other = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    const stop = startWorker({ db, handlers: { llm_test: async () => null }, pollMs: 10 });
    await new Promise((r) => setTimeout(r, 60));
    await stop();
    expect(getTask(db, other)?.status).toBe("queued");
  });

  it("caps concurrency at 4", async () => {
    const db = memDb();
    for (let i = 0; i < 6; i++) enqueue(db, { type: "llm_test", payload: {}, runAt: 0 });
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const stop = startWorker({
      db,
      handlers: {
        llm_test: async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          await gate;
          active--;
          return null;
        },
      },
      pollMs: 5,
    });
    await until(() => active === 4);
    await new Promise((r) => setTimeout(r, 50));
    expect(maxActive).toBe(4);
    release();
    await until(() => (db.$client.prepare("select count(*) c from tasks where status='done'").get() as { c: number }).c === 6);
    await stop();
  });

  it("calls tick", async () => {
    const db = memDb();
    let ticks = 0;
    const stop = startWorker({ db, handlers: {}, pollMs: 10, tick: () => void ticks++, tickMs: 20 });
    await until(() => ticks >= 2);
    await stop();
  });
});
