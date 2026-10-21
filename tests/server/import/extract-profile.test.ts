import { beforeEach, describe, expect, it } from "vitest";
import { extractProfileHandler } from "@/server/import/extract-profile";
import { touchBridge } from "@/server/bridge/presence";
import { getProfile } from "@/server/profile/repo";
import { emptyProfile } from "@/server/profile/schema";
import { claimNext, completeTask, enqueue, getTask } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

describe("extract_profile handler", () => {
  it("merges extracted data and saves the profile", async () => {
    const db = memDb();
    touchBridge(db, Date.now());
    const id = enqueue(db, { type: "extract_profile", payload: { text: "Caio, dev Laravel" } });
    const task = claimNext(db, { runner: "worker" })!;
    const { readyAnswers: _r, cvPath: _c, ...base } = emptyProfile();
    const extracted = {
      ...base,
      personal: { ...base.personal, name: "Caio Mizuno", email: "caio@example.com" },
      skills: [{ name: "Laravel", years: 6, level: null }],
    };
    const run = extractProfileHandler(task, { db, now: Date.now });
    // Simula o ajudante respondendo a chamada de IA.
    await new Promise((r) => setTimeout(r, 300));
    const call = claimNext(db, { runner: "bridge", types: ["llm_call"] })!;
    expect((call.payload as { model: string }).model).toBe("sonnet");
    completeTask(db, call.id, { structured: extracted, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } });
    await expect(run).resolves.toEqual({ ok: true });
    expect(getProfile(db)?.data.personal.name).toBe("Caio Mizuno");
    expect(getProfile(db)?.data.skills[0].name).toBe("Laravel");
    expect(getTask(db, id)?.status).toBe("running");
  });
});
