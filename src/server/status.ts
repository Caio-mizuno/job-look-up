import type { Db } from "@/server/db/client";
import { isBridgeOnline } from "@/server/bridge/presence";
import { isCapReached } from "@/server/llm/usage";

export type SourceRunStatus = { status: "running" | "ok" | "limited" | "error"; count: number; error?: string };

export type AppStatus = {
  bridgeOnline: boolean;
  run: { id: number; status: "running" | "done" | "interrupted"; perSource: Record<string, SourceRunStatus> } | null;
  pendingAnalysis: number;
  capReached: boolean;
  counts: { jobs: number; applications: number };
};

export function getStatus(db: Db, now: number): AppStatus {
  const run = db.$client
    .prepare("select id, status, per_source from search_runs order by id desc limit 1")
    .get() as { id: number; status: "running" | "done" | "interrupted"; per_source: string } | undefined;
  const count = (sql: string) => (db.$client.prepare(sql).get() as { c: number }).c;

  return {
    bridgeOnline: isBridgeOnline(db, now),
    run: run ? { id: run.id, status: run.status, perSource: JSON.parse(run.per_source) } : null,
    pendingAnalysis: count("select count(*) c from tasks where type = 'enrich' and status in ('queued','running')"),
    capReached: isCapReached(db, now),
    counts: {
      jobs: count("select count(*) c from jobs where status != 'discarded'"),
      applications: count("select count(*) c from applications where status != 'cancelled'"),
    },
  };
}
