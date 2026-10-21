import { beforeEach, describe, expect, it } from "vitest";
import { upsertJob } from "@/server/jobs/repo";
import { normalizeRawJob } from "@/server/pipeline/normalize";
import { fallbackQueries, generateQueriesHandler, listQueries, saveQueries } from "@/server/pipeline/queries";
import { recoverOnBoot } from "@/server/pipeline/recover";
import { maybeScheduleSearch } from "@/server/pipeline/schedule";
import { runSearch, startSearchRun } from "@/server/pipeline/search-run";
import { saveProfile } from "@/server/profile/repo";
import { emptyProfile } from "@/server/profile/schema";
import { setSetting } from "@/server/settings";
import { getSourceStates, setSourceEnabled } from "@/server/sources/settings";
import { createHttp, RateLimitedError } from "@/server/sources/http";
import type { JobSource, RawJob } from "@/server/sources/types";
import { claimNext, enqueue } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = Date.UTC(2026, 9, 21, 12);
const rawJob = (source: RawJob["source"], i: number, over: Partial<RawJob> = {}): RawJob => ({
  source,
  sourceJobId: String(i),
  url: `https://${source}.example/job/${i}`,
  title: `Desenvolvedor Laravel ${i}`,
  company: `Empresa ${i}`,
  location: "Remoto",
  workModelHint: "remote",
  contractHint: null,
  salaryText: null,
  postedAt: new Date(NOW),
  descriptionText: "Laravel, Next.js e PostgreSQL. ".repeat(20),
  ...over,
});

function fakeSource(id: RawJob["source"], impl: (page: number) => RawJob[] | Error, extra: Partial<JobSource> = {}): JobSource {
  return {
    id,
    label: id,
    homepage: `https://${id}.example`,
    defaultEnabled: true,
    maxPages: 2,
    async search(_q, page) {
      const r = impl(page);
      if (r instanceof Error) throw r;
      return r;
    },
    ...extra,
  };
}

describe("upsertJob", () => {
  it("merges duplicates from two sources into one row", () => {
    const db = memDb();
    const a = upsertJob(db, normalizeRawJob(rawJob("gupy", 1, { company: "Fintech Aurora LTDA", title: "Desenvolvedor Sênior - Laravel", salaryText: null }), NOW), NOW);
    const b = upsertJob(
      db,
      normalizeRawJob(rawJob("linkedin", 9, { company: "Fintech Aurora", title: "desenvolvedor senior laravel", salaryText: "R$ 12 mil" }), NOW + 5),
      NOW + 5,
    );
    expect(a.inserted).toBe(true);
    expect(b).toEqual({ id: a.id, inserted: false });
    const rows = db.$client.prepare("select source, url, salary_text, last_seen_at from jobs").all();
    expect(rows).toEqual([{ source: "gupy", url: "https://gupy.example/job/1", salary_text: "R$ 12 mil", last_seen_at: NOW + 5 }]);
  });
});

describe("queries", () => {
  it("fallbackQueries max 6 and deduped", () => {
    const p = sampleProfile();
    const qs = fallbackQueries({
      ...p,
      preferences: { ...p.preferences, roles: ["Dev A", "Dev B", "Dev C", "Dev A", "Dev D"], locations: ["São Paulo"] },
    });
    expect(qs.length).toBeLessThanOrEqual(6);
    expect(new Set(qs.map((q) => q.keywords)).size).toBe(qs.length);
    expect(qs[0]).toEqual({ keywords: "Dev A", location: "São Paulo" });
    expect(qs.some((q) => q.keywords === "Dev A Laravel")).toBe(true);
  });

  it("saveQueries marks user and generate_queries preserves them", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    saveQueries(db, [{ keywords: "laravel remoto", location: null }], NOW);
    expect(listQueries(db)).toEqual([{ keywords: "laravel remoto", location: null, origin: "user" }]);
    const id = enqueue(db, { type: "generate_queries", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;
    await generateQueriesHandler(task, { db, now: () => NOW });
    expect(listQueries(db)).toEqual([{ keywords: "laravel remoto", location: null, origin: "user" }]);
    expect(id).toBeGreaterThan(0);
    // e dispara a busca
    expect((db.$client.prepare("select count(*) c from search_runs").get() as { c: number }).c).toBe(1);
  });

  it("generate_queries falls back without bridge and does not defer", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    enqueue(db, { type: "generate_queries", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;
    await expect(generateQueriesHandler(task, { db, now: () => NOW })).resolves.toMatchObject({ fallback: true });
    expect(listQueries(db).length).toBeGreaterThan(0);
    expect(listQueries(db).every((q) => q.origin === "ai")).toBe(true);
  });
});

describe("link queries", () => {
  it("saveQueries drops links and e-mails", () => {
    const db = memDb();
    saveQueries(db, [{ keywords: "https://www.linkedin.com/in/caio-mizuno/", location: null }, { keywords: "laravel", location: null }], NOW);
    expect(listQueries(db).map((q) => q.keywords)).toEqual(["laravel"]);
  });

  it("runSearch ignores a link saved before validation and searches the profile instead", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    db.$client
      .prepare("insert into search_queries (keywords, location, origin, enabled, created_at) values (?, null, 'user', 1, ?)")
      .run("https://www.linkedin.com/in/caio-mizuno/", NOW);
    const seen: string[] = [];
    const src = fakeSource("gupy", () => [], {
      maxPages: 1,
      async search(q) {
        seen.push(q.keywords);
        return [];
      },
    });
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), now: () => NOW, sources: [src] });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((k) => /linkedin|https?:/.test(k))).toBe(false);
  });
});

describe("runSearch", () => {
  it("ok + limited sources, dedup, perSource counts, enrich batches", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    saveQueries(db, [{ keywords: "laravel", location: null }], NOW);
    const ok = fakeSource("gupy", (page) => (page === 1 ? Array.from({ length: 12 }, (_, i) => rawJob("gupy", i)) : []));
    const dup = fakeSource("programathor", () => [rawJob("programathor", 100, { company: "Empresa 1", title: "Desenvolvedor Laravel 1" })]);
    const limited = fakeSource("linkedin", () => new RateLimitedError("429", 429));
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), now: () => NOW, sources: [ok, dup, limited] });

    const run = db.$client.prepare("select status, per_source from search_runs where id = ?").get(runId) as {
      status: string;
      per_source: string;
    };
    expect(run.status).toBe("done");
    expect(JSON.parse(run.per_source)).toEqual({
      gupy: { status: "ok", count: 12 },
      programathor: { status: "ok", count: 1 },
      linkedin: { status: "limited", count: 0, error: "429" },
    });
    expect((db.$client.prepare("select count(*) c from jobs").get() as { c: number }).c).toBe(12);
    const enrich = db.$client.prepare("select payload from tasks where type = 'enrich'").all() as { payload: string }[];
    expect(enrich.map((t) => JSON.parse(t.payload).jobIds.length)).toEqual([5, 5, 2]);
    const states = getSourceStates(db);
    expect(states.find((s) => s.id === "linkedin")?.status).toBe("limited");
  });

  it("filters out jobs that contradict preferences and respects topK", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    setSetting(db, "search.topK", 3);
    const src = fakeSource("gupy", (page) =>
      page === 1
        ? [
            ...Array.from({ length: 5 }, (_, i) => rawJob("gupy", i)),
            rawJob("gupy", 50, { workModelHint: "on-site", location: "Recife" }),
          ]
        : [],
    );
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), now: () => NOW, sources: [src] });
    const ids = (db.$client.prepare("select payload from tasks where type = 'enrich'").all() as { payload: string }[]).flatMap(
      (t) => JSON.parse(t.payload).jobIds as number[],
    );
    expect(ids).toHaveLength(3);
    const onsite = db.$client.prepare("select id from jobs where location = 'Recife'").get() as { id: number };
    expect(ids).not.toContain(onsite.id);
  });

  it("fetches detail for short descriptions among the top jobs", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    const src = fakeSource("linkedin", (page) => (page === 1 ? [rawJob("linkedin", 1, { descriptionText: null })] : []), {
      fetchDetail: async () => "Descrição completa com Laravel e Next.js.",
    });
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), now: () => NOW, sources: [src] });
    expect((db.$client.prepare("select description_text d from jobs").get() as { d: string }).d).toContain("Descrição completa");
  });

  it("hands the bridge browser to sources for search and detail", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    const browser = { getHtml: async (url: string) => `<p>${url}</p>` };
    const src = fakeSource("indeed", () => [], {
      maxPages: 1,
      async search(_q, _page, _http, ctx) {
        const html = await ctx!.browser.getHtml("https://br.indeed.com/jobs?q=x", { waitFor: "[data-jk]" });
        return [rawJob("indeed", 1, { descriptionText: html })];
      },
      fetchDetail: async (url, _http, ctx) => `Descrição via ${await ctx!.browser.getHtml(url, { waitFor: "body" })}`,
    });
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), browser, now: () => NOW, sources: [src] });
    expect((db.$client.prepare("select description_text d from jobs").get() as { d: string }).d).toMatch(/^Descrição via <p>/);
  });

  it("startSearchRun reuses running run", () => {
    const db = memDb();
    const a = startSearchRun(db, "manual", NOW);
    expect(startSearchRun(db, "schedule", NOW + 1)).toBe(a);
    expect((db.$client.prepare("select count(*) c from tasks where type='search_run'").get() as { c: number }).c).toBe(1);
  });
});

describe("schedule & recovery", () => {
  it("maybeScheduleSearch respects interval and 0=off", () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    db.$client.prepare("insert into search_runs (status, trigger, per_source, started_at, finished_at) values ('done','manual','{}',?,?)").run(NOW - 5 * 3600_000, NOW - 5 * 3600_000);
    expect(maybeScheduleSearch(db, NOW)).toBe(false); // 5h < 6h
    expect(maybeScheduleSearch(db, NOW + 3600_000)).toBe(true);
    expect(maybeScheduleSearch(db, NOW + 3600_000)).toBe(false); // já tem run rodando
    const db2 = memDb();
    saveProfile(db2, sampleProfile(), NOW);
    setSetting(db2, "search.intervalHours", 0);
    expect(maybeScheduleSearch(db2, NOW)).toBe(false);
    const db3 = memDb();
    saveProfile(db3, emptyProfile(), NOW);
    expect(maybeScheduleSearch(db3, NOW)).toBe(false);
  });

  it("recoverOnBoot marks running runs interrupted", () => {
    const db = memDb();
    const runId = startSearchRun(db, "manual", NOW);
    claimNext(db, { runner: "worker", now: NOW });
    recoverOnBoot(db, NOW + 1000);
    const run = db.$client.prepare("select status, finished_at from search_runs where id = ?").get(runId) as { status: string; finished_at: number };
    expect(run).toEqual({ status: "interrupted", finished_at: NOW + 1000 });
    expect((db.$client.prepare("select status from tasks").get() as { status: string }).status).toBe("queued");
  });
});

describe("source settings", () => {
  it("defaults and toggles", () => {
    const db = memDb();
    expect(getSourceStates(db).find((s) => s.id === "linkedin")?.enabled).toBe(false);
    expect(getSourceStates(db).find((s) => s.id === "gupy")?.enabled).toBe(true);
    setSourceEnabled(db, "linkedin", true);
    setSourceEnabled(db, "gupy", false);
    expect(getSourceStates(db).find((s) => s.id === "linkedin")?.enabled).toBe(true);
    expect(getSourceStates(db).find((s) => s.id === "gupy")?.enabled).toBe(false);
  });
});
