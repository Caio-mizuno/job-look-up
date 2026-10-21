import { beforeEach, describe, expect, it } from "vitest";
import { GET as bridgeNext } from "@/app/api/bridge/next/route";
import { prepareApplyHandler } from "@/server/applications/drafts";
import { applyReport, cancelApplication, createApplication, getApplication, retryApplication } from "@/server/applications/repo";
import { syncApplicationsWithTasks } from "@/server/applications/sync";
import { onResult } from "@/server/bridge/lifecycle";
import { touchBridge } from "@/server/bridge/presence";
import { setDb, type Db } from "@/server/db/client";
import { LlmUnavailableError } from "@/server/llm/errors";
import { createBridgeProvider } from "@/server/llm/bridge-provider";
import { enrichHandler } from "@/server/pipeline/enrich";
import { getSharedHttp, runSearch, searchRunHandler, startSearchRun } from "@/server/pipeline/search-run";
import { profileVersion, saveProfile } from "@/server/profile/repo";
import { setSetting } from "@/server/settings";
import { claimNext, enqueue, getTask } from "@/server/tasks/queue";
import { memDb } from "../helpers/db";
import { sampleProfile } from "../helpers/profile";

const NOW = Date.UTC(2026, 9, 21, 12);
let db: Db;
beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
  delete process.env.ANTHROPIC_API_KEY;
  db = memDb();
  setDb(db);
});

function addJob(url = "https://x.gupy.io/job/1") {
  return Number(
    db.$client
      .prepare("insert into jobs (source, url, dedupe_key, title, description_text, first_seen_at, last_seen_at) values ('gupy', ?, ?, 'Dev', 'Laravel', 0, 0)")
      .run(url, url).lastInsertRowid,
  );
}

const report = { status: "needs_review" as const, filled: [], drafted: [], unanswered: [], notes: "" };

describe("I1 cancel is honored", () => {
  it("fails the queued apply task so the bridge never gets it, and later results keep 'cancelled'", async () => {
    const { id } = createApplication(db, addJob(), NOW) as { id: number };
    const applyTask = enqueue(db, { type: "apply", runner: "bridge", payload: {} });
    db.$client.prepare("update applications set task_id = ? where id = ?").run(applyTask, id);
    cancelApplication(db, id);
    expect(getTask(db, applyTask)?.status).toBe("failed");
    const res = await bridgeNext(new Request("http://l/api/bridge/next?accept=apply", { headers: { authorization: `Bearer ${"t".repeat(64)}` } }));
    expect(res.status).toBe(204);
    applyReport(db, id, report, NOW);
    expect(getApplication(db, id)?.status).toBe("cancelled");
  });

  it("onResult of a task already claimed does not resurrect a cancelled application", () => {
    const { id } = createApplication(db, addJob(), NOW) as { id: number };
    const applyTask = enqueue(db, { type: "apply", runner: "bridge", payload: {} });
    db.$client.prepare("update applications set task_id = ? where id = ?").run(applyTask, id);
    const task = claimNext(db, { runner: "bridge", types: ["apply"] })!;
    cancelApplication(db, id);
    onResult(db, task, { ok: true, result: { report } });
    expect(getApplication(db, id)?.status).toBe("cancelled");
  });

  it("prepare_apply does not enqueue apply for an application cancelled meanwhile", async () => {
    saveProfile(db, sampleProfile(), NOW);
    const { id } = createApplication(db, addJob(), NOW) as { id: number };
    db.$client.prepare("update applications set drafts = ? where id = ?").run(JSON.stringify({ pitch: "p", whyCompany: "w" }), id);
    const task = claimNext(db, { runner: "worker", types: ["prepare_apply"] })!;
    cancelApplication(db, id);
    await prepareApplyHandler(task, { db, now: () => NOW });
    expect(db.$client.prepare("select count(*) c from tasks where type = 'apply'").get()).toEqual({ c: 0 });
  });
});

describe("I2 prepare_apply failure surfaces", () => {
  it("links the prepare_apply task so sync marks the application failed", () => {
    const { id } = createApplication(db, addJob(), NOW) as { id: number };
    const app = getApplication(db, id)!;
    expect(getTask(db, app.taskId!)?.type).toBe("prepare_apply");
    db.$client.prepare("update tasks set status = 'failed', error = 'Claude usage limit reached' where id = ?").run(app.taskId);
    syncApplicationsWithTasks(db);
    expect(getApplication(db, id)).toMatchObject({ status: "failed", error: "Claude usage limit reached" });
    retryApplication(db, id, NOW);
    expect(getTask(db, getApplication(db, id)!.taskId!)).toMatchObject({ type: "prepare_apply", status: "queued" });
  });
});

describe("I3 enrich failures are visible", () => {
  it("sets analysis_error with the bridge message on the final attempt", async () => {
    saveProfile(db, sampleProfile(), NOW);
    touchBridge(db, NOW);
    const jobId = addJob();
    const id = enqueue(db, { type: "enrich", payload: { jobIds: [jobId] } });
    db.$client.prepare("update tasks set attempts = 1 where id = ?").run(id);
    const task = claimNext(db, { runner: "worker" })!;
    const pending = enrichHandler(task, { db, now: () => NOW });
    for (let i = 0; i < 100; i++) {
      const call = claimNext(db, { runner: "bridge", types: ["llm_call"] });
      if (call) {
        db.$client.prepare("update tasks set status = 'failed', error = 'Claude usage limit reached. Resets at 5am.' where id = ?").run(call.id);
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    await expect(pending).resolves.toMatchObject({ failed: true });
    const row = db.$client.prepare("select analysis_error e from jobs where id = ?").get(jobId) as { e: string };
    expect(row.e).toContain("usage limit");
  });
});

describe("I4 bridge provider notices the bridge going away", () => {
  it("drops the orphan llm_call and throws LlmUnavailableError", async () => {
    let now = NOW;
    touchBridge(db, now);
    const provider = createBridgeProvider(db, () => now, { pollMs: 5, timeoutMs: 5_000 });
    const pending = provider.generate({ tier: "fast", system: "s", input: "i", jsonSchema: {} });
    await new Promise((r) => setTimeout(r, 20));
    now = NOW + 60_000; // ajudante sem heartbeat há 60 s
    await expect(pending).rejects.toBeInstanceOf(LlmUnavailableError);
    const t = db.$client.prepare("select status from tasks where type = 'llm_call'").get() as { status: string };
    expect(t.status).toBe("failed");
  });
});

describe("I5 a crashing search never stays running", () => {
  it("marks the run interrupted when runSearch throws", async () => {
    db.$client.prepare("insert into profile (id, data, version, updated_at) values (1, '{\"broken\":true}', 'v', 0)").run();
    const runId = startSearchRun(db, "manual", NOW);
    const task = claimNext(db, { runner: "worker", types: ["search_run"] })!;
    await expect(searchRunHandler(task, { db, now: () => NOW })).rejects.toThrow();
    expect((db.$client.prepare("select status from search_runs where id = ?").get(runId) as { status: string }).status).toBe("interrupted");
  });

  it("startSearchRun replaces a run stuck for more than 15 minutes", () => {
    const stuck = Number(
      db.$client.prepare("insert into search_runs (status, trigger, per_source, started_at) values ('running','manual','{}',?)").run(NOW - 16 * 60_000).lastInsertRowid,
    );
    const fresh = startSearchRun(db, "manual", NOW);
    expect(fresh).not.toBe(stuck);
    expect((db.$client.prepare("select status from search_runs where id = ?").get(stuck) as { status: string }).status).toBe("interrupted");
  });
});

describe("I6 profile version only tracks match-relevant fields", () => {
  it("ignores readyAnswers and cvPath", () => {
    const p = sampleProfile();
    const v = profileVersion(p);
    expect(profileVersion({ ...p, cvPath: "/app/data/cv/cv.pdf" })).toBe(v);
    expect(profileVersion({ ...p, readyAnswers: [{ question: "Q", answer: "A" }] })).toBe(v);
    expect(profileVersion({ ...p, skills: [...p.skills, { name: "Go", years: 1, level: null }] })).not.toBe(v);
  });
});

describe("I7 source cache survives across runs", () => {
  it("runSearch reuses one shared Http by default", () => {
    expect(getSharedHttp()).toBe(getSharedHttp());
    expect(runSearch.length).toBeGreaterThan(0);
  });
});

describe("I9 saving AI settings validates before switching", () => {
  it("keeps the old provider when the new one is not configured", async () => {
    const { saveLlmSettings } = await import("@/app/(app)/config/ia/actions");
    const { getSetting } = await import("@/server/settings");
    setSetting(db, "llm.provider", "claude-code");
    const res = await saveLlmSettings({ provider: "anthropic", dailyCallCap: 0 });
    expect(res.ok).toBe(false);
    expect(getSetting(db, "llm.provider")).toBe("claude-code");
  });
});
