import { beforeEach, describe, expect, it } from "vitest";
import { touchBridge } from "@/server/bridge/presence";
import { generateCoverLetterHandler, getCoverLetter, saveCoverLetter } from "@/server/cover-letter/generate";
import { saveProfile } from "@/server/profile/repo";
import { claimNext, completeTask, enqueue } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = 1_800_000_000_000;

describe("generate_cover_letter handler", () => {
  it("writes the letter from the profile and stores it", async () => {
    const db = memDb();
    touchBridge(db, NOW);
    saveProfile(db, sampleProfile(), NOW);
    enqueue(db, { type: "generate_cover_letter", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;

    const run = generateCoverLetterHandler(task, { db, now: () => NOW });
    await new Promise((r) => setTimeout(r, 300));
    const call = claimNext(db, { runner: "bridge", types: ["llm_call"], now: NOW })!;
    const payload = call.payload as { model: string; input: string };
    expect(payload.model).toBe("sonnet");
    expect(payload.input).toContain("Caio Mizuno");
    expect(payload.input).toContain("MizunoTech");
    completeTask(db, call.id, { structured: { letter: "Prezado(a) recrutador(a),\n\nSou o Caio." }, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } });

    await expect(run).resolves.toEqual({ ok: true, text: "Prezado(a) recrutador(a),\n\nSou o Caio." });
    expect(getCoverLetter(db)).toEqual({ text: "Prezado(a) recrutador(a),\n\nSou o Caio.", updatedAt: NOW });
  });

  it("skips without a profile and keeps no letter", async () => {
    const db = memDb();
    enqueue(db, { type: "generate_cover_letter", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;
    await expect(generateCoverLetterHandler(task, { db, now: () => NOW })).resolves.toEqual({ skipped: "sem perfil" });
    expect(getCoverLetter(db)).toBeNull();
  });

  it("defers instead of failing when the helper is off", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    enqueue(db, { type: "generate_cover_letter", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;
    await expect(generateCoverLetterHandler(task, { db, now: () => NOW })).resolves.toEqual({ deferred: true });
  });
});

describe("saveCoverLetter", () => {
  it("keeps the edited text and when it changed", () => {
    const db = memDb();
    expect(getCoverLetter(db)).toBeNull();
    saveCoverLetter(db, "  Minha carta  ", NOW);
    expect(getCoverLetter(db)).toEqual({ text: "Minha carta", updatedAt: NOW });
  });
});
