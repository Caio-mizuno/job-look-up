import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/tasks/[id]/route";
import { setDb, type Db } from "@/server/db/client";
import { claimNext, completeTask, enqueue } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

let db: Db;
beforeEach(() => {
  db = memDb();
  setDb(db);
});

const call = (id: number) => GET(new Request(`http://localhost/api/tasks/${id}`), { params: Promise.resolve({ id: String(id) }) });

describe("GET /api/tasks/:id", () => {
  it("returns llm_test status and result", async () => {
    const id = enqueue(db, { type: "llm_test", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker" });
    completeTask(db, id, { ok: true });
    const res = await call(id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "done", result: { ok: true }, error: null });
  });

  it("shows the cover letter task so the page can wait for it", async () => {
    const id = enqueue(db, { type: "generate_cover_letter", payload: {}, runAt: 0 });
    expect((await call(id)).status).toBe(200);
  });

  it("shows the study task so the page can wait for it", async () => {
    const id = enqueue(db, { type: "generate_study", payload: {}, runAt: 0 });
    expect((await call(id)).status).toBe(200);
  });

  it("404 for apply and unknown ids", async () => {
    const apply = enqueue(db, { type: "apply", runner: "bridge", payload: { secret: 1 }, runAt: 0 });
    expect((await call(apply)).status).toBe(404);
    expect((await call(999)).status).toBe(404);
  });
});
