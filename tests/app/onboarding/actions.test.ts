import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { finishOnboarding, saveStep, startImport, uploadCv } from "@/app/onboarding/actions";
import { setDb, type Db } from "@/server/db/client";
import { getProfile } from "@/server/profile/repo";
import { getSetting } from "@/server/settings";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

let db: Db;
beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  process.env.BRIDGE_TOKEN = "t".repeat(64);
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "jl-data-"));
  db = memDb();
  setDb(db);
});

const personal = (email: string) => ({
  personal: { ...sampleProfile().personal, email },
  headline: "Dev",
  summary: "",
});

describe("saveStep", () => {
  it("rejects invalid email", async () => {
    const res = await saveStep(2, personal("nope"));
    expect(res.ok).toBe(false);
    expect(getProfile(db)).toBeNull();
  });

  it("saves the section and marks the step completed", async () => {
    const res = await saveStep(2, personal("caio@example.com"));
    expect(res).toEqual({ ok: true });
    expect(getProfile(db)?.data.personal.email).toBe("caio@example.com");
    expect(getSetting(db, "onboarding.completedSteps")).toEqual([2]);
    await saveStep(0, {});
    expect(getSetting(db, "onboarding.completedSteps")).toEqual([0, 2]);
  });

  it("keeps other sections intact", async () => {
    await saveStep(6, sampleProfile().preferences);
    await saveStep(2, personal("caio@example.com"));
    expect(getProfile(db)?.data.preferences.roles).toEqual(["Desenvolvedor Full Stack"]);
  });
});

describe("finishOnboarding", () => {
  it("returns missing when not ready", async () => {
    expect(await finishOnboarding()).toEqual({ ok: false, missing: ["name", "email", "experienceOrSkill", "preferences"] });
  });

  it("enqueues generate_queries and the cover letter when ready", async () => {
    const p = sampleProfile();
    await saveStep(2, { personal: p.personal, headline: p.headline, summary: p.summary });
    await saveStep(3, p.experiences);
    await saveStep(6, p.preferences);
    expect(await finishOnboarding()).toEqual({ ok: true });
    const t = db.$client.prepare("select type from tasks order by id").all();
    expect(t).toEqual([{ type: "generate_queries" }, { type: "generate_cover_letter" }]);
  });
});

describe("uploadCv", () => {
  const form = (name: string, content: string) => {
    const fd = new FormData();
    fd.set("cv", new File([content], name));
    return fd;
  };

  it("rejects non-pdf", async () => {
    expect(await uploadCv(form("cv.docx", "x"))).toEqual({ ok: false, error: "not_pdf" });
    expect(await uploadCv(form("cv.pdf", "não é pdf"))).toEqual({ ok: false, error: "not_pdf" });
  });

  it("stores pdf and sets cvPath", async () => {
    const res = await uploadCv(form("Meu CV.pdf", "%PDF-1.4 conteúdo"));
    expect(res).toEqual({ ok: true });
    expect(getProfile(db)?.data.cvPath).toBe(join(process.env.DATA_DIR!, "cv", "cv.pdf"));
  });
});

describe("startImport", () => {
  it("enqueues extract_profile from pasted text", async () => {
    const fd = new FormData();
    fd.set("text", "Desenvolvedor Laravel com 6 anos de experiência em Next.js e PostgreSQL na MizunoTech.");
    const res = await startImport(fd);
    expect("taskId" in res).toBe(true);
    const row = db.$client.prepare("select type, payload from tasks").get() as { type: string; payload: string };
    expect(row.type).toBe("extract_profile");
    expect(JSON.parse(row.payload).text).toContain("Laravel");
  });

  it("returns no_text for tiny input", async () => {
    const fd = new FormData();
    fd.set("text", "oi");
    expect(await startImport(fd)).toEqual({ error: "no_text" });
  });
});
