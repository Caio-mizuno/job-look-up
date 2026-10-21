import { describe, expect, it } from "vitest";
import { localScore, passesPreferences } from "@/server/pipeline/prefilter";
import { sampleProfile } from "../../helpers/profile";

const NOW = Date.UTC(2026, 9, 21);
const DAY = 86_400_000;
const job = (over: Partial<Parameters<typeof localScore>[0]> = {}) => ({
  title: "Desenvolvedor",
  descriptionText: "",
  postedAt: null as number | null,
  ...over,
});

describe("localScore", () => {
  it("favors skill hits and recency", () => {
    const p = sampleProfile();
    const none = localScore(job(), p, NOW);
    const skills = localScore(job({ descriptionText: "Laravel, Next.js e Postgres" }), p, NOW);
    const recent = localScore(job({ descriptionText: "Laravel, Next.js e Postgres", postedAt: NOW - DAY }), p, NOW);
    expect(none).toBe(0);
    expect(skills).toBeGreaterThan(none);
    expect(recent).toBe(skills + 15);
    expect(localScore(job({ postedAt: NOW - 20 * DAY }), p, NOW)).toBe(5);
  });

  it("matches aliases with word boundaries", () => {
    const p = sampleProfile({ skills: [{ name: "Vue", years: 2, level: null }], experiences: [] });
    expect(localScore(job({ descriptionText: "Experiência com Vue.js 3" }), p, NOW)).toBeGreaterThan(0);
    expect(localScore(job({ descriptionText: "Revue de código" }), p, NOW)).toBe(0);
  });

  it("caps at 100", () => {
    const p = sampleProfile({ skills: [{ name: "PHP", years: 1, level: null }], experiences: [] });
    expect(localScore(job({ title: "PHP", postedAt: NOW }), p, NOW)).toBeLessThanOrEqual(100);
  });
});

describe("passesPreferences", () => {
  const prefs = sampleProfile().preferences; // remote, clt/pj, locations []
  it("rejects onsite elsewhere for remote-only", () => {
    expect(passesPreferences({ workModel: "onsite", contract: null, location: "Curitiba" }, prefs)).toBe(false);
    expect(passesPreferences({ workModel: "remote", contract: null, location: null }, prefs)).toBe(true);
    expect(passesPreferences({ workModel: null, contract: null, location: null }, prefs)).toBe(true);
  });

  it("accepts hybrid in an accepted city", () => {
    const p = { ...prefs, workModels: ["remote", "hybrid"] as ("remote" | "hybrid")[], locations: ["São Paulo"] };
    expect(passesPreferences({ workModel: "hybrid", contract: null, location: "Sao Paulo - SP" }, p)).toBe(true);
    expect(passesPreferences({ workModel: "hybrid", contract: null, location: "Recife" }, p)).toBe(false);
    expect(passesPreferences({ workModel: "hybrid", contract: null, location: "Recife" }, { ...p, willingToRelocate: true })).toBe(true);
  });

  it("rejects unwanted contract only when known", () => {
    const p = { ...prefs, contracts: ["clt" as const] };
    expect(passesPreferences({ workModel: "remote", contract: "pj", location: null }, p)).toBe(false);
    expect(passesPreferences({ workModel: "remote", contract: null, location: null }, p)).toBe(true);
  });
});
