import type { Db } from "@/server/db/client";
import { getSetting } from "@/server/settings";
import { LlmCapReachedError } from "./errors";
import type { LlmUsage } from "./types";

const startOfDay = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const startOfMonth = (now: number) => {
  const d = new Date(now);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function recordUsage(
  db: Db,
  row: { task: string; provider: string; model: string; usage: LlmUsage; at: number },
): void {
  db.$client
    .prepare(
      "insert into llm_usage (at, task, provider, model, input_tokens, output_tokens, cost_usd) values (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(row.at, row.task, row.provider, row.model, row.usage.inputTokens, row.usage.outputTokens, row.usage.costUsd);
}

export function callsToday(db: Db, now: number): number {
  return (db.$client.prepare("select count(*) c from llm_usage where at >= ?").get(startOfDay(now)) as { c: number }).c;
}

export function usageThisMonth(db: Db, now: number = Date.now()): { calls: number; inputTokens: number; outputTokens: number } {
  const row = db.$client
    .prepare(
      "select count(*) calls, coalesce(sum(input_tokens),0) inputTokens, coalesce(sum(output_tokens),0) outputTokens from llm_usage where at >= ?",
    )
    .get(startOfMonth(now)) as { calls: number; inputTokens: number; outputTokens: number };
  return row;
}

export function isCapReached(db: Db, now: number): boolean {
  const cap = getSetting(db, "llm.dailyCallCap");
  return cap > 0 && callsToday(db, now) >= cap;
}

export function assertUnderCap(db: Db, now: number): void {
  if (isCapReached(db, now)) throw new LlmCapReachedError("teto diário de chamadas de IA atingido");
}
