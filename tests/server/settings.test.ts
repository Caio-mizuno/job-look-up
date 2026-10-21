import { beforeEach, describe, expect, it } from "vitest";
import { getSetting, setSetting } from "@/server/settings";
import { memDb } from "../helpers/db";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
});

describe("settings", () => {
  it("returns defaults", () => {
    const db = memDb();
    expect(getSetting(db, "search.intervalHours")).toBe(6);
    expect(getSetting(db, "search.topK")).toBe(40);
    expect(getSetting(db, "llm.provider")).toBe("claude-code");
    expect(getSetting(db, "bridge.privacyAcceptedAt")).toBeNull();
    expect(getSetting(db, "onboarding.completedSteps")).toEqual([]);
  });

  it("persists plain values", () => {
    const db = memDb();
    setSetting(db, "search.intervalHours", 12);
    expect(getSetting(db, "search.intervalHours")).toBe(12);
  });

  it("encrypts secrets at rest", () => {
    const db = memDb();
    setSetting(db, "llm.anthropicApiKey", "sk-x");
    const raw = db.$client.prepare("select value from settings where key = ?").get("llm.anthropicApiKey") as {
      value: string;
    };
    expect(raw.value).toMatch(/^v1:/);
    expect(raw.value).not.toContain("sk-x");
    expect(getSetting(db, "llm.anthropicApiKey")).toBe("sk-x");
  });

  it("encrypts object secrets", () => {
    const db = memDb();
    setSetting(db, "llm.openaiCompatible", { baseUrl: "http://localhost:11434/v1", model: "llama3", apiKey: "k" });
    expect(getSetting(db, "llm.openaiCompatible")).toEqual({
      baseUrl: "http://localhost:11434/v1",
      model: "llama3",
      apiKey: "k",
    });
  });
});
