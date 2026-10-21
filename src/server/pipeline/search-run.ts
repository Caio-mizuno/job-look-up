import pLimit from "p-limit";
import type { Db } from "@/server/db/client";
import { setJobDescription, upsertJob } from "@/server/jobs/repo";
import { getProfile } from "@/server/profile/repo";
import { getSetting } from "@/server/settings";
import { createHttp, RateLimitedError, type Http } from "@/server/sources/http";
import { enabledSources, updateSourceStatus } from "@/server/sources/settings";
import type { JobSource, SearchQuery } from "@/server/sources/types";
import type { Handler } from "@/server/tasks/handlers";
import { enqueue } from "@/server/tasks/queue";
import type { SourceRunStatus } from "@/server/status";
import { normalizeRawJob } from "./normalize";
import { localScore, passesPreferences } from "./prefilter";
import { fallbackQueries, listQueries } from "./queries";

export const ENRICH_BATCH = 5;
const PER_SOURCE_CONCURRENCY = 2;
const SHORT_DESCRIPTION = 400;

export function startSearchRun(db: Db, trigger: "manual" | "schedule", now: number): number {
  const running = db.$client.prepare("select id from search_runs where status = 'running' order by id desc limit 1").get() as
    | { id: number }
    | undefined;
  if (running) return running.id;
  const res = db.$client
    .prepare("insert into search_runs (status, trigger, per_source, started_at) values ('running', ?, '{}', ?)")
    .run(trigger, now);
  const runId = Number(res.lastInsertRowid);
  enqueue(db, { type: "search_run", payload: { runId } });
  return runId;
}

function patchRunSource(db: Db, runId: number, sourceId: string, patch: Partial<SourceRunStatus>) {
  const row = db.$client.prepare("select per_source from search_runs where id = ?").get(runId) as { per_source: string };
  const per = JSON.parse(row.per_source) as Record<string, SourceRunStatus>;
  per[sourceId] = { ...(per[sourceId] ?? { status: "running", count: 0 }), ...patch };
  db.$client.prepare("update search_runs set per_source = ? where id = ?").run(JSON.stringify(per), runId);
}

async function searchSource(
  db: Db,
  runId: number,
  source: JobSource,
  queries: SearchQuery[],
  http: Http,
  now: () => number,
): Promise<void> {
  patchRunSource(db, runId, source.id, { status: "running", count: 0 });
  const limit = pLimit(PER_SOURCE_CONCURRENCY);
  const seen = new Set<string>();
  let limited = false;
  let lastError: string | null = null;

  await Promise.all(
    queries.map((q) =>
      limit(async () => {
        for (let page = 1; page <= source.maxPages && !limited; page++) {
          try {
            const raws = await source.search(q, page, http);
            for (const raw of raws) {
              const job = normalizeRawJob(raw, now());
              upsertJob(db, job, now());
              seen.add(job.dedupeKey);
            }
            patchRunSource(db, runId, source.id, { count: seen.size });
            if (raws.length === 0) break;
          } catch (err) {
            if (err instanceof RateLimitedError) {
              limited = true;
              lastError = err.message;
            } else {
              lastError = err instanceof Error ? err.message : String(err);
            }
            break;
          }
        }
      }),
    ),
  );

  const status = limited ? "limited" : lastError && seen.size === 0 ? "error" : "ok";
  patchRunSource(db, runId, source.id, {
    status,
    count: seen.size,
    ...(lastError && status !== "ok" ? { error: lastError } : {}),
  });
  updateSourceStatus(db, source.id, status, status === "ok" ? null : lastError, now());
}

type CandidateRow = {
  id: number;
  source: string;
  url: string;
  title: string;
  description_text: string | null;
  posted_at: number | null;
  work_model: "remote" | "hybrid" | "onsite" | null;
  contract: "clt" | "pj" | "other" | null;
  location: string | null;
};

export async function runSearch(
  db: Db,
  opts: { runId: number; http?: Http; now?: () => number; sources?: JobSource[] },
): Promise<void> {
  const now = opts.now ?? Date.now;
  const http = opts.http ?? createHttp();
  const run = db.$client.prepare("select started_at from search_runs where id = ?").get(opts.runId) as
    | { started_at: number }
    | undefined;
  if (!run) return;
  const profile = getProfile(db);
  const sources = opts.sources ?? enabledSources(db);
  const saved = listQueries(db);
  const queries = saved.length > 0 ? saved : profile ? fallbackQueries(profile.data) : [];

  await Promise.all(sources.map((s) => searchSource(db, opts.runId, s, queries, http, now)));

  if (profile) {
    const candidates = (
      db.$client
        .prepare(
          `select id, source, url, title, description_text, posted_at, work_model, contract, location from jobs
           where last_seen_at >= ? and status != 'discarded'
             and id not in (select job_id from job_enrichment where profile_version = ?)`,
        )
        .all(run.started_at, profile.version) as CandidateRow[]
    ).filter((j) =>
      passesPreferences({ workModel: j.work_model, contract: j.contract, location: j.location }, profile.data.preferences),
    );

    const setScore = db.$client.prepare("update jobs set local_score = ? where id = ?");
    const scored = candidates.map((j) => {
      const score = localScore({ title: j.title, descriptionText: j.description_text, postedAt: j.posted_at }, profile.data, now());
      setScore.run(score, j.id);
      return { ...j, score };
    });
    const top = scored.sort((a, b) => b.score - a.score || b.id - a.id).slice(0, getSetting(db, "search.topK"));

    // Fontes que só listam: busca o texto completo das vagas que vão para a IA.
    const bySource = new Map(sources.map((s) => [s.id as string, s]));
    const detailLimit = new Map<string, ReturnType<typeof pLimit>>();
    await Promise.all(
      top
        .filter((j) => (j.description_text ?? "").length < SHORT_DESCRIPTION && bySource.get(j.source)?.fetchDetail)
        .map((j) => {
          const limiter = detailLimit.get(j.source) ?? pLimit(PER_SOURCE_CONCURRENCY);
          detailLimit.set(j.source, limiter);
          return limiter(async () => {
            try {
              const text = await bySource.get(j.source)!.fetchDetail!(j.url, http);
              if (text) setJobDescription(db, j.id, text);
            } catch {
              // Sem detalhe a vaga segue com o que a listagem trouxe.
            }
          });
        }),
    );

    for (let i = 0; i < top.length; i += ENRICH_BATCH) {
      enqueue(db, { type: "enrich", payload: { jobIds: top.slice(i, i + ENRICH_BATCH).map((j) => j.id) } });
    }
  }

  db.$client.prepare("update search_runs set status = 'done', finished_at = ? where id = ?").run(now(), opts.runId);
}

export const searchRunHandler: Handler = async (task, { db, now }) => {
  const { runId } = task.payload as { runId: number };
  await runSearch(db, { runId, now });
  return { runId };
};
