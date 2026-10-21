import { describe, expect, it } from "vitest";
import { callsToday, isCapReached, recordUsage, usageThisMonth } from "@/server/llm/usage";
import { setSetting } from "@/server/settings";
import { memDb } from "../../helpers/db";

process.env.APP_KEY = "c".repeat(64);

describe("usage", () => {
  it("counts calls today and this month", () => {
    const db = memDb();
    const now = new Date(2026, 9, 21, 12).getTime();
    const yesterday = new Date(2026, 9, 20, 12).getTime();
    const lastMonth = new Date(2026, 8, 30, 12).getTime();
    const u = { inputTokens: 100, outputTokens: 10, costUsd: null };
    recordUsage(db, { task: "enrich", provider: "claude-code", model: "haiku", usage: u, at: now });
    recordUsage(db, { task: "enrich", provider: "claude-code", model: "haiku", usage: u, at: yesterday });
    recordUsage(db, { task: "enrich", provider: "claude-code", model: "haiku", usage: u, at: lastMonth });
    expect(callsToday(db, now)).toBe(1);
    expect(usageThisMonth(db, now)).toEqual({ calls: 2, inputTokens: 200, outputTokens: 20 });
  });

  it("isCapReached is false when cap is 0", () => {
    const db = memDb();
    expect(isCapReached(db, Date.now())).toBe(false);
    setSetting(db, "llm.dailyCallCap", 1);
    recordUsage(db, {
      task: "test",
      provider: "claude-code",
      model: "haiku",
      usage: { inputTokens: 1, outputTokens: 1, costUsd: null },
      at: Date.now(),
    });
    expect(isCapReached(db, Date.now())).toBe(true);
  });
});
