import { beforeEach, describe, expect, it } from "vitest";
import { GET as next } from "@/app/api/bridge/next/route";
import { POST as result } from "@/app/api/bridge/tasks/[id]/result/route";
import { setDb, type Db } from "@/server/db/client";
import { getSetting } from "@/server/settings";
import { claimNext, enqueue, getTask } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

const TOKEN = "t".repeat(64);
let db: Db;

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = TOKEN;
  db = memDb();
  setDb(db);
});

const nextReq = (accept: string, token: string | null = TOKEN) =>
  new Request(`http://localhost/api/bridge/next?accept=${accept}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

const resultReq = (id: number, body: unknown, token: string | null = TOKEN) =>
  result(
    new Request(`http://localhost/api/bridge/tasks/${id}/result`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );

describe("GET /api/bridge/next", () => {
  it("401 without or with wrong token", async () => {
    expect((await next(nextReq("llm_call", null))).status).toBe(401);
    expect((await next(nextReq("llm_call", "x".repeat(64)))).status).toBe(401);
  });

  it("204 and heartbeat when nothing queued", async () => {
    const before = Date.now();
    const res = await next(nextReq("llm_call"));
    expect(res.status).toBe(204);
    expect(getSetting(db, "bridge.lastSeenAt")).toBeGreaterThanOrEqual(before);
  });

  it("204 with empty accept even if tasks exist", async () => {
    enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    expect((await next(nextReq(""))).status).toBe(204);
  });

  it("returns only bridge tasks of accepted types", async () => {
    enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    enqueue(db, { type: "apply", runner: "bridge", payload: { a: 1 }, runAt: 0 });
    const llm = enqueue(db, { type: "llm_call", runner: "bridge", payload: { model: "haiku" }, runAt: 0 });
    const res = await next(nextReq("llm_call"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: llm, type: "llm_call", payload: { model: "haiku" } });
    expect((await next(nextReq("llm_call"))).status).toBe(204);
  });
});

describe("POST /api/bridge/tasks/:id/result", () => {
  it("401 without token", async () => {
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    claimNext(db, { runner: "bridge" });
    expect((await resultReq(id, { ok: true, result: 1 }, null)).status).toBe(401);
  });

  it("result ok completes task with result", async () => {
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    claimNext(db, { runner: "bridge" });
    const res = await resultReq(id, { ok: true, result: { structured: { ok: true } } });
    expect(res.status).toBe(204);
    expect(getTask(db, id)).toMatchObject({ status: "done", result: { structured: { ok: true } } });
  });

  it("result error requeues (attempt 1) then fails (attempt 2)", async () => {
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    claimNext(db, { runner: "bridge" });
    await resultReq(id, { ok: false, error: "limite" });
    expect(getTask(db, id)?.status).toBe("queued");
    db.$client.prepare("update tasks set run_at = 0 where id = ?").run(id);
    claimNext(db, { runner: "bridge" });
    await resultReq(id, { ok: false, error: "limite de novo" });
    expect(getTask(db, id)).toMatchObject({ status: "failed", error: "limite de novo" });
  });

  it("404 for unknown or not running task", async () => {
    expect((await resultReq(999, { ok: true, result: null })).status).toBe(404);
    const queued = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    expect((await resultReq(queued, { ok: true, result: null })).status).toBe(404);
    const worker = enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker" });
    expect((await resultReq(worker, { ok: true, result: null })).status).toBe(404);
  });

  it("400 for invalid body", async () => {
    const id = enqueue(db, { type: "llm_call", runner: "bridge", payload: {}, runAt: 0 });
    claimNext(db, { runner: "bridge" });
    expect((await resultReq(id, { nope: true })).status).toBe(400);
  });
});
