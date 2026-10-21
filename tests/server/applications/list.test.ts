import { describe, expect, it } from "vitest";
import { listApplications } from "@/server/applications/list";
import { appendEvents, applyReport, createApplication } from "@/server/applications/repo";
import { listJobs } from "@/server/jobs/list";
import { memDb } from "../../helpers/db";

function addJob(db: ReturnType<typeof memDb>, i: number) {
  return Number(
    db.$client
      .prepare("insert into jobs (source, url, dedupe_key, title, company, first_seen_at, last_seen_at) values ('gupy', ?, ?, ?, 'X', 0, 0)")
      .run(`https://x.gupy.io/job/${i}`, `k${i}`, `Vaga ${i}`).lastInsertRowid,
  );
}

describe("listApplications", () => {
  it("orders by createdAt desc and includes last 10 events and report lists", () => {
    const db = memDb();
    const a = createApplication(db, addJob(db, 1), 100) as { id: number };
    const b = createApplication(db, addJob(db, 2), 200) as { id: number };
    appendEvents(db, a.id, Array.from({ length: 15 }, (_, i) => ({ at: i, kind: "tool" as const, text: `t${i}` })));
    applyReport(db, a.id, { status: "needs_review", filled: ["Nome"], drafted: ["Por que"], unanswered: ["Pretensão"], notes: "" }, 300);
    const list = listApplications(db);
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
    const item = list[1];
    expect(item.events).toHaveLength(10);
    expect(item.events[9].text).toBe("t14");
    expect(item.job).toMatchObject({ title: "Vaga 1", company: "X", url: "https://x.gupy.io/job/1" });
    expect(item.report?.unanswered).toEqual(["Pretensão"]);
  });

  it("excludes cancelled", () => {
    const db = memDb();
    const a = createApplication(db, addJob(db, 1), 100) as { id: number };
    db.$client.prepare("update applications set status = 'cancelled' where id = ?").run(a.id);
    expect(listApplications(db)).toEqual([]);
  });
});

describe("listJobs application state", () => {
  it("exposes the latest non-cancelled application per job", () => {
    const db = memDb();
    const jobId = addJob(db, 1);
    const old = createApplication(db, jobId, 100) as { id: number };
    db.$client.prepare("update applications set status = 'failed' where id = ?").run(old.id);
    const fresh = createApplication(db, jobId, 200) as { id: number };
    const [item] = listJobs(db, { sort: "match" }, { profileVersion: null, lastVisitAt: 0 }).items;
    expect(item.application).toEqual({ id: fresh.id, status: "queued" });
  });
});
