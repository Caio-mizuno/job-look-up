import { beforeEach, describe, expect, it } from "vitest";
import { touchBridge } from "@/server/bridge/presence";
import { recordUsage } from "@/server/llm/usage";
import { setSetting } from "@/server/settings";
import { getStatus } from "@/server/status";
import { claimNext, enqueue } from "@/server/tasks/queue";
import { memDb } from "../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = 2_000_000_000_000;

describe("getStatus", () => {
  it("bridgeOnline at 9s, offline at 11s", () => {
    const db = memDb();
    touchBridge(db, NOW - 9_000);
    expect(getStatus(db, NOW).bridgeOnline).toBe(true);
    touchBridge(db, NOW - 11_000);
    expect(getStatus(db, NOW).bridgeOnline).toBe(false);
  });

  it("pendingAnalysis counts queued+running enrich tasks", () => {
    const db = memDb();
    enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    enqueue(db, { type: "enrich", payload: {}, runAt: 0 });
    enqueue(db, { type: "search_run", payload: {}, runAt: 0 });
    claimNext(db, { runner: "worker", types: ["enrich"] });
    expect(getStatus(db, NOW).pendingAnalysis).toBe(2);
  });

  it("capReached mirrors daily cap", () => {
    const db = memDb();
    expect(getStatus(db, NOW).capReached).toBe(false);
    setSetting(db, "llm.dailyCallCap", 1);
    recordUsage(db, {
      task: "enrich",
      provider: "claude-code",
      model: "haiku",
      usage: { inputTokens: 1, outputTokens: 1, costUsd: null },
      at: NOW,
    });
    expect(getStatus(db, NOW).capReached).toBe(true);
  });

  it("returns the latest search run and counts", () => {
    const db = memDb();
    expect(getStatus(db, NOW).run).toBeNull();
    db.$client
      .prepare("insert into search_runs (status, trigger, per_source, started_at) values ('done','manual','{}',1), ('running','manual',?,2)")
      .run(JSON.stringify({ gupy: { status: "ok", count: 3 } }));
    db.$client
      .prepare(
        "insert into jobs (source, url, dedupe_key, title, status, first_seen_at, last_seen_at) values ('gupy','u1','k1','A','new',0,0), ('gupy','u2','k2','B','discarded',0,0)",
      )
      .run();
    const s = getStatus(db, NOW);
    expect(s.run).toEqual({ id: 2, status: "running", perSource: { gupy: { status: "ok", count: 3 } } });
    expect(s.counts).toEqual({ jobs: 1, applications: 0 });
  });
});
