import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import type { ApplicationStatus } from "@/server/db/schema";
import { applyJobs } from "@/server/applications/repo";
import { memDb } from "../../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = Date.UTC(2026, 9, 22, 12);

function addJob(db: Db, url: string) {
  const r = db.$client
    .prepare(
      "insert into jobs (source, url, dedupe_key, title, status, first_seen_at, last_seen_at) values ('gupy', ?, ?, 'Dev', 'new', 0, 0)",
    )
    .run(url, url);
  return Number(r.lastInsertRowid);
}

function withApplication(db: Db, jobId: number, status: ApplicationStatus) {
  const r = db.$client
    .prepare("insert into applications (job_id, status, created_at) values (?, ?, ?)")
    .run(jobId, status, NOW - 1000);
  return Number(r.lastInsertRowid);
}

const appsOf = (db: Db, jobId: number) =>
  db.$client.prepare("select id, status from applications where job_id = ? order by id").all(jobId) as {
    id: number;
    status: string;
  }[];

describe("applyJobs", () => {
  it("applyJobs skips active and dedupes", () => {
    const db = memDb();
    const A = addJob(db, "https://a.gupy.io/job/1");
    const B = addJob(db, "https://b.gupy.io/job/1");
    const C = addJob(db, "https://c.gupy.io/job/1");
    const D = addJob(db, "https://d.gupy.io/job/1");
    const E = addJob(db, "https://www.linkedin.com/jobs/view/1");
    const F = addJob(db, "https://f.gupy.io/job/1");
    withApplication(db, B, "running");
    withApplication(db, C, "needs_review");
    withApplication(db, D, "submitted");
    const failed = withApplication(db, F, "failed");

    const res = applyJobs(db, [A, A, B, C, D, E, F, 999], NOW);

    expect(res.queued).toEqual([A, F]);
    expect(res.skipped).toEqual([
      { jobId: B, reason: "active" },
      { jobId: C, reason: "active" },
      { jobId: D, reason: "active" },
      { jobId: E, reason: "linkedin" },
      { jobId: 999, reason: "not_found" },
    ]);
    expect(appsOf(db, A)).toEqual([{ id: expect.any(Number), status: "queued" }]);
    expect(appsOf(db, F)).toEqual([{ id: failed, status: "queued" }]);
    expect(appsOf(db, B)).toHaveLength(1);
  });

  it("caps the batch at 50", () => {
    const db = memDb();
    const ids = Array.from({ length: 55 }, (_, i) => addJob(db, `https://x.gupy.io/job/${i}`));

    const res = applyJobs(db, ids, NOW);

    expect(res.queued).toEqual(ids.slice(0, 50));
    expect(res.skipped).toEqual(ids.slice(50).map((jobId) => ({ jobId, reason: "limit" })));
    const count = db.$client.prepare("select count(*) c from applications").get() as { c: number };
    expect(count.c).toBe(50);
  });
});
