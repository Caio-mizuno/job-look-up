import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/bridge/tasks/[id]/events/route";
import { createApplication, getApplication } from "@/server/applications/repo";
import { setDb, type Db } from "@/server/db/client";
import { claimNext, enqueue } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

const TOKEN = "t".repeat(64);
let db: Db;
beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = TOKEN;
  db = memDb();
  setDb(db);
});

const call = (id: number, body: unknown, token: string | null = TOKEN) =>
  POST(
    new Request(`http://localhost/api/bridge/tasks/${id}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );

describe("POST /api/bridge/tasks/:id/events", () => {
  it("401 without token; appends to the application of a running apply task", async () => {
    const jobId = Number(
      db.$client.prepare("insert into jobs (source, url, dedupe_key, title, first_seen_at, last_seen_at) values ('gupy','https://x.gupy.io/job/1','k','T',0,0)").run().lastInsertRowid,
    );
    const { id } = createApplication(db, jobId, 0) as { id: number };
    const taskId = enqueue(db, { type: "apply", runner: "bridge", payload: {} });
    db.$client.prepare("update applications set task_id = ? where id = ?").run(taskId, id);
    claimNext(db, { runner: "bridge", types: ["apply"] });

    expect((await call(taskId, { events: [] }, null)).status).toBe(401);
    expect((await call(taskId, { events: [{ at: 1, kind: "tool", text: "navigate" }] })).status).toBe(204);
    expect(getApplication(db, id)?.events).toEqual([{ at: 1, kind: "tool", text: "navigate" }]);
    expect((await call(taskId, { events: [{ at: 1, kind: "bogus", text: "x" }] })).status).toBe(400);
    expect((await call(9999, { events: [] })).status).toBe(404);
  });
});
