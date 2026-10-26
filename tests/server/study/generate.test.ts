import { beforeEach, describe, expect, it } from "vitest";
import { touchBridge } from "@/server/bridge/presence";
import type { Db } from "@/server/db/client";
import { saveProfile } from "@/server/profile/repo";
import { generateStudyHandler, getStudyPlan, MAX_STUDY_THEMES } from "@/server/study/generate";
import { claimNext, completeTask, enqueue } from "@/server/tasks/queue";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = 1_800_000_000_000;

let seq = 0;
function job(db: Db, description: string) {
  seq += 1;
  db.$client
    .prepare(
      "insert into jobs (source, url, dedupe_key, title, description_text, local_score, status, first_seen_at, last_seen_at) values ('gupy', ?, ?, 'Dev', ?, 0, 'new', ?, ?)",
    )
    .run(`https://g.example/${seq}`, `k${seq}`, description, NOW, NOW);
}

const topic = (themeId: string) => ({
  themeId,
  summary: "Pedido em 2 vagas.",
  concepts: ["Estado global x local"],
  options: [{ name: "Redux", whenToUse: "Apps grandes com muitas telas." }],
  steps: ["Monte um contador com Zustand."],
  interview: ["Quando Context API basta?"],
  exercise: "Carrinho de compras com Zustand.",
  docs: ["Documentação oficial do Redux"],
});

async function runWith(db: Db, structured: unknown) {
  enqueue(db, { type: "generate_study", payload: {} });
  const task = claimNext(db, { runner: "worker" })!;
  const run = generateStudyHandler(task, { db, now: () => NOW });
  await new Promise((r) => setTimeout(r, 300));
  const call = claimNext(db, { runner: "bridge", types: ["llm_call"], now: NOW })!;
  completeTask(db, call.id, { structured, usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 } });
  return { call, result: await run };
}

describe("generate_study handler", () => {
  it("writes the study material for the most requested themes and keeps the counts it used", async () => {
    const db = memDb();
    touchBridge(db, NOW);
    saveProfile(db, sampleProfile(), NOW);
    job(db, "Redux e Zustand");
    job(db, "Context API e Docker");

    const { call, result } = await runWith(db, { topics: [topic("state"), topic("inventado")] });

    const payload = call.payload as { model: string; input: string };
    expect(payload.model).toBe("sonnet");
    const input = JSON.parse(payload.input);
    expect(input.vagasNaListagem).toBe(2);
    expect(input.temas[0]).toMatchObject({ id: "state", tema: "Controle de estado", vagas: 2, prioridade: "lacuna" });
    expect(input.perfil.habilidades).toContain("Laravel (6 anos)");

    const plan = getStudyPlan(db)!;
    expect(result).toEqual({ ok: true, plan });
    expect(plan).toMatchObject({ totalJobs: 2, updatedAt: NOW });
    expect(plan.topics).toHaveLength(1);
    expect(plan.topics[0]).toMatchObject({
      ...topic("state"),
      theme: { id: "state", label: "Controle de estado", jobs: 2, priority: "lacuna" },
    });
  });

  it(`sends at most ${MAX_STUDY_THEMES} themes`, async () => {
    const db = memDb();
    touchBridge(db, NOW);
    saveProfile(db, sampleProfile(), NOW);
    job(db, "React, Redux, CSS, Python, Laravel, GraphQL, MySQL, AWS, Docker, Kafka, Jest, Flutter, Scrum, Pandas");

    const { call } = await runWith(db, { topics: [topic("frontend")] });

    expect(JSON.parse((call.payload as { input: string }).input).temas).toHaveLength(MAX_STUDY_THEMES);
  });

  it("skips when the listing names no technology", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    job(db, "Vaga sem stack nenhuma.");
    enqueue(db, { type: "generate_study", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;

    await expect(generateStudyHandler(task, { db, now: () => NOW })).resolves.toEqual({ skipped: "sem tecnologias nas vagas" });
    expect(getStudyPlan(db)).toBeNull();
  });

  it("skips without a profile", async () => {
    const db = memDb();
    enqueue(db, { type: "generate_study", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;
    await expect(generateStudyHandler(task, { db, now: () => NOW })).resolves.toEqual({ skipped: "sem perfil" });
  });

  it("defers instead of failing when the helper is off", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    job(db, "React");
    enqueue(db, { type: "generate_study", payload: {} });
    const task = claimNext(db, { runner: "worker" })!;
    await expect(generateStudyHandler(task, { db, now: () => NOW })).resolves.toEqual({ deferred: true });
  });
});
