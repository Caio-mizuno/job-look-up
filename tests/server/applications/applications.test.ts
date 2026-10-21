import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { onClaim, onResult } from "@/server/bridge/lifecycle";
import { touchBridge } from "@/server/bridge/presence";
import type { Db } from "@/server/db/client";
import { prepareApplyHandler } from "@/server/applications/drafts";
import { buildApplyPayload, isAutoApplyAllowed } from "@/server/applications/payload";
import {
  answerUnanswered,
  applyReport,
  appendEvents,
  cancelApplication,
  createApplication,
  getApplication,
  markSubmitted,
  retryApplication,
} from "@/server/applications/repo";
import type { ApplyReport } from "@/server/applications/schema";
import { syncApplicationsWithTasks } from "@/server/applications/sync";
import { getProfile, saveProfile } from "@/server/profile/repo";
import { claimNext, completeTask, enqueue, getTask } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = Date.UTC(2026, 9, 21, 12);

function addJob(db: Db, url = "https://empresa.gupy.io/job/1") {
  const r = db.$client
    .prepare(
      "insert into jobs (source, url, dedupe_key, title, company, description_text, status, first_seen_at, last_seen_at) values ('gupy', ?, ?, 'Dev Laravel', 'Empresa X', 'Laravel e Vue', 'new', 0, 0)",
    )
    .run(url, url);
  return Number(r.lastInsertRowid);
}

const report = (over: Partial<ApplyReport> = {}): ApplyReport => ({ status: "needs_review", filled: ["Nome"], drafted: ["Por que"], unanswered: ["Pretensão"], notes: "ok", ...over });

describe("isAutoApplyAllowed", () => {
  it("blocks linkedin hosts and non-http", () => {
    for (const u of ["https://www.linkedin.com/jobs/view/1", "https://br.linkedin.com/x", "https://lnkd.in/a", "javascript:x", "ftp://a.com"])
      expect(isAutoApplyAllowed(u)).toBe(false);
    expect(isAutoApplyAllowed("https://empresa.gupy.io/job/1")).toBe(true);
  });
});

describe("createApplication", () => {
  it("for linkedin returns error and enqueues nothing", () => {
    const db = memDb();
    const jobId = addJob(db, "https://br.linkedin.com/jobs/view/1");
    expect(createApplication(db, jobId, NOW)).toEqual({ error: "linkedin" });
    expect((db.$client.prepare("select count(*) c from tasks").get() as { c: number }).c).toBe(0);
  });

  it("queues prepare_apply and marks job interested", () => {
    const db = memDb();
    const jobId = addJob(db);
    const res = createApplication(db, jobId, NOW);
    expect("id" in res).toBe(true);
    expect((db.$client.prepare("select status from jobs where id = ?").get(jobId) as { status: string }).status).toBe("interested");
    expect((db.$client.prepare("select type from tasks").get() as { type: string }).type).toBe("prepare_apply");
    expect(createApplication(db, 999, NOW)).toEqual({ error: "not_found" });
  });
});

describe("prepare_apply", () => {
  it("caches drafts and enqueues bridge apply with payload", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    touchBridge(db, NOW);
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    const task = claimNext(db, { runner: "worker" })!;
    const pending = prepareApplyHandler(task, { db, now: () => NOW });
    let call = null;
    for (let i = 0; i < 100 && !call; i++) {
      call = claimNext(db, { runner: "bridge", types: ["llm_call"] });
      if (!call) await new Promise((r) => setTimeout(r, 20));
    }
    completeTask(db, call!.id, { structured: { pitch: "Sou dev Laravel.", whyCompany: "Gosto do produto.", message: "Olá, pessoal!" }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } });
    await pending;
    const app = getApplication(db, id)!;
    expect(app.drafts).toEqual({ pitch: "Sou dev Laravel.", whyCompany: "Gosto do produto.", message: "Olá, pessoal!" });
    const apply = getTask(db, app.taskId!)!;
    expect(apply).toMatchObject({ type: "apply", runner: "bridge", status: "queued" });
    expect((apply.payload as { jobUrl: string }).jobUrl).toBe("https://empresa.gupy.io/job/1");

    // Segunda vez não chama a IA de novo.
    retryApplication(db, id, NOW);
    const again = claimNext(db, { runner: "worker", types: ["prepare_apply"] })!;
    await prepareApplyHandler(again, { db, now: () => NOW });
    expect(db.$client.prepare("select count(*) c from tasks where type = 'llm_call'").get()).toEqual({ c: 1 });
  });
});

describe("buildApplyPayload", () => {
  it("drops empty answers, merges extraAnswers, embeds cv", () => {
    const db = memDb();
    const dir = mkdtempSync(join(tmpdir(), "jl-cv-"));
    const cvPath = join(dir, "cv.pdf");
    writeFileSync(cvPath, "%PDF-1.4 teste");
    const p = sampleProfile({ cvPath });
    p.readyAnswers[0].answer = "R$ 12.000";
    saveProfile(db, p, NOW);
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    db.$client
      .prepare("update applications set drafts = ?, extra_answers = ? where id = ?")
      .run(JSON.stringify({ pitch: "p", whyCompany: "w" }), JSON.stringify([{ question: "Q extra", answer: "A extra" }]), id);
    const payload = buildApplyPayload(db, id);
    expect(payload.readyAnswers).toEqual([
      { question: "Pretensão salarial (CLT)", answer: "R$ 12.000" },
      { question: "Q extra", answer: "A extra" },
    ]);
    expect(payload.cv).toEqual({ filename: "cv.pdf", base64: Buffer.from("%PDF-1.4 teste").toString("base64") });
    expect(payload.drafts.pitch).toBe("p");
    expect(payload.drafts.message).toContain("Dev Laravel"); // sem mensagem da IA → mensagem genérica da vaga
    expect(payload.profile.personal.email).toBe("caio@example.com");
  });
});

describe("lifecycle", () => {
  function queuedApply(db: Db) {
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    const taskId = enqueue(db, { type: "apply", runner: "bridge", payload: {} });
    db.$client.prepare("update applications set task_id = ? where id = ?").run(taskId, id);
    return { id, jobId, taskId };
  }

  it("claim marks running; ok result maps report statuses", () => {
    const db = memDb();
    const { id } = queuedApply(db);
    const task = claimNext(db, { runner: "bridge", types: ["apply"] })!;
    onClaim(db, task);
    expect(getApplication(db, id)?.status).toBe("running");
    onResult(db, task, { ok: true, result: { report: report() } });
    expect(getApplication(db, id)).toMatchObject({ status: "needs_review", report: report() });
  });

  it("drops the CV bytes from the task payload once the bridge reports back", () => {
    const db = memDb();
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    const taskId = enqueue(db, { type: "apply", runner: "bridge", payload: { jobUrl: "https://x", cv: { filename: "cv.pdf", base64: "AAAA" } } });
    db.$client.prepare("update applications set task_id = ? where id = ?").run(taskId, id);
    const task = claimNext(db, { runner: "bridge", types: ["apply"] })!;
    onResult(db, task, { ok: true, result: { report: report() } });
    expect(getTask(db, taskId)?.payload).toEqual({ jobUrl: "https://x" });
  });

  it("applyReport maps statuses", () => {
    const db = memDb();
    const { id } = queuedApply(db);
    for (const [status, expected] of [
      ["needs_review", "needs_review"],
      ["login_required", "login_required"],
      ["blocked", "failed"],
      ["error", "failed"],
    ] as const) {
      applyReport(db, id, report({ status }), NOW);
      expect(getApplication(db, id)?.status).toBe(expected);
    }
    expect(getApplication(db, id)?.error).toBe("ok");
  });

  it("invalid report or bridge error fails the application without auto-retry", () => {
    const db = memDb();
    const { id, taskId } = queuedApply(db);
    const task = claimNext(db, { runner: "bridge", types: ["apply"] })!;
    onResult(db, task, { ok: false, error: "Chrome fechado" });
    expect(getApplication(db, id)).toMatchObject({ status: "failed", error: "Chrome fechado" });
    expect(getTask(db, taskId)?.status).toBe("failed");
  });
});

describe("repo actions", () => {
  it("appendEvents caps text and total", () => {
    const db = memDb();
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    appendEvents(db, id, [{ at: 1, kind: "text", text: "x".repeat(3000) }]);
    for (let i = 0; i < 6; i++) appendEvents(db, id, Array.from({ length: 100 }, (_, j) => ({ at: i * 100 + j, kind: "tool" as const, text: "t" })));
    const events = getApplication(db, id)!.events;
    expect(events).toHaveLength(500);
    expect(events[events.length - 1].at).toBe(599);
  });

  it("answerUnanswered saveAsReady upserts profile readyAnswers", () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    answerUnanswered(
      db,
      id,
      [
        { question: "Pretensão salarial (CLT)", answer: "R$ 15.000", saveAsReady: true },
        { question: "Tem CNH?", answer: "Sim", saveAsReady: true },
        { question: "Só desta vaga", answer: "x", saveAsReady: false },
      ],
      NOW,
    );
    const answers = getProfile(db)!.data.readyAnswers;
    expect(answers.find((a) => a.question === "Pretensão salarial (CLT)")?.answer).toBe("R$ 15.000");
    expect(answers.find((a) => a.question === "Tem CNH?")?.answer).toBe("Sim");
    expect(answers.some((a) => a.question === "Só desta vaga")).toBe(false);
    expect(getApplication(db, id)!.extraAnswers).toHaveLength(3);
  });

  it("markSubmitted and cancel", () => {
    const db = memDb();
    const jobId = addJob(db);
    const { id } = createApplication(db, jobId, NOW) as { id: number };
    markSubmitted(db, id, NOW);
    expect(getApplication(db, id)?.status).toBe("submitted");
    expect((db.$client.prepare("select status from jobs where id = ?").get(jobId) as { status: string }).status).toBe("applied");
    cancelApplication(db, id);
    expect(getApplication(db, id)?.status).toBe("cancelled");
  });
});

describe("syncApplicationsWithTasks", () => {
  it("resets running→queued when task requeued and fails when task failed", () => {
    const db = memDb();
    const jobId = addJob(db);
    const a = createApplication(db, jobId, NOW) as { id: number };
    const b = createApplication(db, jobId, NOW) as { id: number };
    const t1 = enqueue(db, { type: "apply", runner: "bridge", payload: {} });
    const t2 = enqueue(db, { type: "apply", runner: "bridge", payload: {} });
    db.$client.prepare("update applications set status = 'running', task_id = ? where id = ?").run(t1, a.id);
    db.$client.prepare("update applications set status = 'running', task_id = ? where id = ?").run(t2, b.id);
    db.$client.prepare("update tasks set status = 'failed', error = 'interrompida' where id = ?").run(t2);
    syncApplicationsWithTasks(db);
    expect(getApplication(db, a.id)?.status).toBe("queued");
    expect(getApplication(db, b.id)).toMatchObject({ status: "failed", error: "interrompida" });
  });
});
