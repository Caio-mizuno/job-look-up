import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { countDiscarded, listJobs, restoreDiscarded, setJobStatus } from "@/server/jobs/list";
import { upsertJob } from "@/server/jobs/repo";
import { normalizeRawJob } from "@/server/pipeline/normalize";
import type { RawJob, SourceId } from "@/server/sources/types";
import { memDb } from "../../helpers/db";

const NOW = Date.UTC(2026, 9, 22, 12);
const ctx = { profileVersion: null, lastVisitAt: 0, now: NOW };

const raw = (source: SourceId, title: string, company: string | null, url: string): RawJob => ({
  source,
  sourceJobId: null,
  url,
  title,
  company,
  location: null,
  workModelHint: null,
  contractHint: null,
  salaryText: null,
  postedAt: null,
  descriptionText: null,
});

const add = (db: Db, r: RawJob) => upsertJob(db, normalizeRawJob(r, NOW), NOW);
const visibleIds = (db: Db) => listJobs(db, { sort: "recent" }, ctx).items.map((j) => j.id);

describe("discarded jobs cache", () => {
  it("discarded job stays hidden when found again", () => {
    const db = memDb();
    const { id } = add(db, raw("gupy", "Dev PHP", "Acme", "https://acme.gupy.io/job/1"));
    setJobStatus(db, id, "discarded", 1);

    const again = add(db, raw("indeed", "Dev PHP", "Acme", "https://br.indeed.com/viewjob?jk=abc"));

    expect(again).toEqual({ id, inserted: false });
    const row = db.$client.prepare("select status from jobs where id = ?").get(id) as { status: string };
    expect(row.status).toBe("discarded");
    expect(visibleIds(db)).not.toContain(id);
    expect(countDiscarded(db)).toBe(1);
  });

  it("restoreDiscarded brings them back as seen", () => {
    const db = memDb();
    const a = add(db, raw("gupy", "Dev A", "Acme", "https://acme.gupy.io/job/a")).id;
    const b = add(db, raw("gupy", "Dev B", "Acme", "https://acme.gupy.io/job/b")).id;
    const c = add(db, raw("gupy", "Dev C", "Acme", "https://acme.gupy.io/job/c")).id;
    setJobStatus(db, a, "discarded", 1);
    setJobStatus(db, b, "discarded", 1);

    expect(restoreDiscarded(db)).toBe(2);

    const statuses = db.$client.prepare("select id, status from jobs order by id").all();
    expect(statuses).toEqual([
      { id: a, status: "seen" },
      { id: b, status: "seen" },
      { id: c, status: "new" },
    ]);
    expect(countDiscarded(db)).toBe(0);
    expect(visibleIds(db).sort()).toEqual([a, b, c].sort());
  });
});
