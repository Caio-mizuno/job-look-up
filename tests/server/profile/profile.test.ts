import { describe, expect, it } from "vitest";
import { DEFAULT_READY_QUESTIONS } from "@/server/profile/default-answers";
import { mergeExtracted } from "@/server/profile/merge";
import { isSearchReady } from "@/server/profile/readiness";
import { getProfile, profileVersion, saveProfile } from "@/server/profile/repo";
import { emptyProfile, ProfileSchema, type ExtractedProfile } from "@/server/profile/schema";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

describe("profile schema", () => {
  it("emptyProfile is valid and has default questions", () => {
    const p = emptyProfile();
    expect(ProfileSchema.safeParse(p).success).toBe(true);
    expect(p.readyAnswers.map((a) => a.question)).toEqual(DEFAULT_READY_QUESTIONS);
    expect(p.readyAnswers.every((a) => a.answer === "")).toBe(true);
    expect(DEFAULT_READY_QUESTIONS).toHaveLength(8);
  });

  it("rejects invalid email but accepts empty", () => {
    const p = emptyProfile();
    expect(ProfileSchema.safeParse({ ...p, personal: { ...p.personal, email: "nope" } }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...p, personal: { ...p.personal, email: "" } }).success).toBe(true);
  });
});

describe("profile repo", () => {
  it("version stable across key order and changes on edit", () => {
    const p = sampleProfile();
    const reordered = JSON.parse(JSON.stringify({ preferences: p.preferences, ...p }));
    expect(profileVersion(reordered)).toBe(profileVersion(p));
    expect(profileVersion({ ...p, headline: "Outro" })).not.toBe(profileVersion(p));
    expect(profileVersion(p)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("saveProfile reports changed and getProfile reads back", () => {
    const db = memDb();
    expect(getProfile(db)).toBeNull();
    const first = saveProfile(db, sampleProfile(), 1);
    expect(first.changed).toBe(true);
    expect(saveProfile(db, sampleProfile(), 2).changed).toBe(false);
    expect(getProfile(db)).toEqual({ data: sampleProfile(), version: first.version });
    expect(saveProfile(db, sampleProfile({ headline: "Tech Lead" }), 3).changed).toBe(true);
  });
});

describe("isSearchReady", () => {
  it("lists missing parts", () => {
    expect(isSearchReady(emptyProfile())).toEqual({
      ready: false,
      missing: ["name", "email", "experienceOrSkill", "preferences"],
    });
    expect(isSearchReady(sampleProfile())).toEqual({ ready: true, missing: [] });
  });

  it("needs a role and a work model", () => {
    const p = sampleProfile();
    expect(isSearchReady({ ...p, preferences: { ...p.preferences, workModels: [] } }).missing).toEqual(["preferences"]);
  });
});

describe("mergeExtracted", () => {
  const extracted = (over: Partial<ExtractedProfile> = {}): ExtractedProfile => {
    const { readyAnswers: _r, cvPath: _c, ...rest } = emptyProfile();
    return { ...rest, ...over };
  };

  it("keeps filled email and fills empty fields", () => {
    const current = sampleProfile();
    const merged = mergeExtracted(
      current,
      extracted({
        personal: { ...current.personal, email: "outro@x.com", phone: "11999990000" },
        headline: "Ignorado",
      }),
    );
    expect(merged.personal.email).toBe("caio@example.com");
    expect(merged.personal.phone).toBe("11999990000");
    expect(merged.headline).toBe("Desenvolvedor Full Stack");
  });

  it("ignores invalid extracted email", () => {
    const merged = mergeExtracted(emptyProfile(), extracted({ personal: { ...emptyProfile().personal, email: "não tem" } }));
    expect(merged.personal.email).toBe("");
  });

  it("dedupes experiences by company+title and unions skills", () => {
    const current = sampleProfile();
    const merged = mergeExtracted(
      current,
      extracted({
        experiences: [
          { ...current.experiences[0], title: "desenvolvedor full stack", company: "MIZUNOTECH" },
          { title: "Dev PHP", company: "Empresa X", start: "2019-01", end: "2021-12", workModel: null, description: "", technologies: ["PHP"] },
        ],
        skills: [
          { name: "laravel", years: 1, level: null },
          { name: "Docker", years: 4, level: null },
        ],
      }),
    );
    expect(merged.experiences.map((e) => e.company)).toEqual(["MizunoTech", "Empresa X"]);
    expect(merged.skills.map((s) => s.name)).toEqual(["Laravel", "Next.js", "PostgreSQL", "Docker"]);
  });

  it("keeps ready answers and cv path", () => {
    const current = { ...sampleProfile(), cvPath: "/app/data/cv/cv.pdf" };
    const merged = mergeExtracted(current, extracted());
    expect(merged.cvPath).toBe("/app/data/cv/cv.pdf");
    expect(merged.readyAnswers).toEqual(current.readyAnswers);
  });
});
