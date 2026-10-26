import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/client";
import { listJobs } from "@/server/jobs/list";
import { setSourceEnabled } from "@/server/sources/settings";
import { memDb } from "../../helpers/db";

const NOW = Date.UTC(2026, 9, 21, 12);
const DAY = 86_400_000;

function job(db: Db, i: number, over: Record<string, unknown> = {}) {
  const row = {
    source: "gupy",
    url: `https://g.example/${i}`,
    dedupe_key: `k${i}`,
    title: `Vaga ${i}`,
    company: null,
    work_model: "remote",
    contract: null,
    seniority: null,
    posted_at: NOW - i * DAY,
    local_score: 0,
    status: "new",
    analysis_error: null,
    first_seen_at: NOW - DAY,
    last_seen_at: NOW,
    ...over,
  };
  const cols = Object.keys(row);
  const res = db.$client
    .prepare(`insert into jobs (${cols.join(",")}) values (${cols.map(() => "?").join(",")})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

function enrich(db: Db, jobId: number, score: number, version = "v1", createdAt = NOW) {
  db.$client
    .prepare("insert into job_enrichment (job_id, profile_version, match_score, data, model, created_at) values (?, ?, ?, ?, 'haiku', ?)")
    .run(
      jobId,
      version,
      score,
      JSON.stringify({ why: "w", gaps: [], summary: "s", offers: [], responsibilities: [], requirements: [], workModel: null, contract: null, salary: null }),
      createdAt,
    );
}

const ctx = { profileVersion: "v1", lastVisitAt: 0, now: NOW };

describe("listJobs", () => {
  it("brings the post contact e-mail and when the e-mail was sent", () => {
    const db = memDb();
    const a = job(db, 1, { contact_email: "rh@x.com" });
    const b = job(db, 2, { contact_email: "rh@y.com" });
    const c = job(db, 3);
    const add = db.$client.prepare(
      "insert into outreach_emails (job_id, to_email, subject, body, status, error, created_at) values (?, ?, 's', 'b', ?, ?, ?)",
    );
    add.run(a, "rh@x.com", "failed", "erro", NOW - 10);
    add.run(a, "rh@x.com", "sent", null, NOW - 5);
    add.run(b, "rh@y.com", "failed", "erro", NOW - 5);
    const byId = Object.fromEntries(listJobs(db, { sort: "recent" }, ctx).items.map((j) => [j.id, j]));
    expect(byId[a]).toMatchObject({ contactEmail: "rh@x.com", emailSentAt: NOW - 5 });
    expect(byId[b]).toMatchObject({ contactEmail: "rh@y.com", emailSentAt: null });
    expect(byId[c]).toMatchObject({ contactEmail: null, emailSentAt: null });
  });

  it("excludes discarded and filters workModels", () => {
    const db = memDb();
    job(db, 1);
    job(db, 2, { status: "discarded" });
    job(db, 3, { work_model: "onsite" });
    expect(listJobs(db, { sort: "match" }, ctx).items.map((j) => j.title)).toEqual(["Vaga 3", "Vaga 1"]);
    expect(listJobs(db, { sort: "match", workModels: ["onsite"] }, ctx).items.map((j) => j.title)).toEqual(["Vaga 3"]);
  });

  it("sort match puts unenriched after enriched, then by localScore", () => {
    const db = memDb();
    const a = job(db, 1, { local_score: 90 });
    const b = job(db, 2, { local_score: 10 });
    const c = job(db, 3, { local_score: 50 });
    enrich(db, b, 70);
    expect(listJobs(db, { sort: "match" }, ctx).items.map((j) => j.id)).toEqual([b, a, c]);
  });

  it("sort recent orders by posting date", () => {
    const db = memDb();
    const old = job(db, 9);
    const fresh = job(db, 1);
    expect(listJobs(db, { sort: "recent" }, ctx).items.map((j) => j.id)).toEqual([fresh, old]);
  });

  it("cursor pages are disjoint and complete", () => {
    const db = memDb();
    for (let i = 0; i < 7; i++) {
      const id = job(db, i, { local_score: i % 3 });
      if (i % 2 === 0) enrich(db, id, 50 + (i % 4));
    }
    const p1 = listJobs(db, { sort: "match", limit: 3 }, ctx);
    const p2 = listJobs(db, { sort: "match", limit: 3, cursor: p1.nextCursor! }, ctx);
    const p3 = listJobs(db, { sort: "match", limit: 3, cursor: p2.nextCursor! }, ctx);
    const ids = [...p1.items, ...p2.items, ...p3.items].map((j) => j.id);
    expect(new Set(ids).size).toBe(7);
    expect(p3.nextCursor).toBeNull();
    const all = listJobs(db, { sort: "match", limit: 20 }, ctx).items.map((j) => j.id);
    expect(ids).toEqual(all);
  });

  it("stale when enrichment version differs; isNew by lastVisitAt", () => {
    const db = memDb();
    const a = job(db, 1, { first_seen_at: NOW - 10 });
    enrich(db, a, 60, "old");
    const [item] = listJobs(db, { sort: "match" }, { ...ctx, lastVisitAt: NOW - 100 }).items;
    expect(item.enrichment?.stale).toBe(true);
    expect(item.enrichment?.matchScore).toBe(60);
    expect(item.isNew).toBe(true);
    enrich(db, a, 75, "v1", NOW + 1);
    const [fresh] = listJobs(db, { sort: "match" }, { ...ctx, lastVisitAt: NOW }).items;
    expect(fresh.enrichment).toMatchObject({ stale: false, matchScore: 75 });
    expect(fresh.isNew).toBe(false);
  });

  it("analysis: failed, pending only when queued, none otherwise", () => {
    const db = memDb();
    job(db, 1, { analysis_error: "análise falhou" });
    const queued = job(db, 2);
    job(db, 3);
    db.$client
      .prepare("insert into tasks (type, runner, payload, status, attempts, run_at, created_at) values ('enrich','worker',?, 'queued',0,0,0)")
      .run(JSON.stringify({ jobIds: [queued] }));
    const items = listJobs(db, { sort: "recent" }, ctx).items;
    expect(items.map((j) => j.analysis)).toEqual(["failed", "pending", "none"]);
  });

  it("filters lastDays and unseenOnly", () => {
    const db = memDb();
    job(db, 1);
    job(db, 10);
    job(db, 2, { status: "seen" });
    expect(listJobs(db, { sort: "recent", lastDays: 7 }, ctx).items.map((j) => j.title)).toEqual(["Vaga 1", "Vaga 2"]);
    expect(listJobs(db, { sort: "recent", unseenOnly: true }, ctx).items.map((j) => j.title)).toEqual(["Vaga 1", "Vaga 10"]);
  });

  it("exposes source label and homepage", () => {
    const db = memDb();
    job(db, 1, { source: "remoteok" });
    expect(listJobs(db, { sort: "match" }, ctx).items[0]).toMatchObject({ sourceLabel: "Remote OK", sourceHomepage: "https://remoteok.com" });
  });

  it("hides jobs from disabled sources and shows them again when re-enabled", () => {
    const db = memDb();
    job(db, 1, { source: "gupy" });
    job(db, 2, { source: "himalayas" });
    job(db, 3, { source: "linkedin" }); // desligada por padrão, sem linha em sources
    setSourceEnabled(db, "himalayas", false);
    expect(listJobs(db, { sort: "recent" }, ctx).items.map((j) => j.source)).toEqual(["gupy"]);
    setSourceEnabled(db, "himalayas", true);
    expect(listJobs(db, { sort: "recent" }, ctx).items.map((j) => j.source)).toEqual(["gupy", "himalayas"]);
  });
});

describe("consumeLastVisit", () => {
  it("returns the previous visit and stores now", async () => {
    const { consumeLastVisit } = await import("@/server/jobs/list");
    const db = memDb();
    expect(consumeLastVisit(db, 100)).toBe(0);
    expect(consumeLastVisit(db, 200)).toBe(100);
  });
});
