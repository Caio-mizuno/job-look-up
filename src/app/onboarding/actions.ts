"use server";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/server/db/client";
import { extractText, ImportError, MAX_IMPORT_BYTES, MAX_IMPORT_CHARS } from "@/server/import/extract-text";
import { isSearchReady, type ReadinessGap } from "@/server/profile/readiness";
import { getProfile, saveProfile } from "@/server/profile/repo";
import { emptyProfile, type Profile } from "@/server/profile/schema";
import { applySection, SECTION_SCHEMAS, type SectionStep } from "@/server/profile/sections";
import { getSetting, setSetting, type LastImport } from "@/server/settings";
import { enqueue } from "@/server/tasks/queue";

const MIN_TEXT = 50;

function markCompleted(step: number) {
  const db = getDb();
  const done = new Set(getSetting(db, "onboarding.completedSteps"));
  done.add(step);
  setSetting(db, "onboarding.completedSteps", [...done].sort((a, b) => a - b));
}

export async function loadProfile(): Promise<Profile> {
  return getProfile(getDb())?.data ?? emptyProfile();
}

export async function saveStep(
  step: number,
  data: unknown,
): Promise<{ ok: true } | { ok: false; errors: { path: string; message: string }[] }> {
  if (step in SECTION_SCHEMAS) {
    const parsed = SECTION_SCHEMAS[step as SectionStep].safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    }
    const db = getDb();
    const current = getProfile(db)?.data ?? emptyProfile();
    saveProfile(db, applySection(current, step as SectionStep, parsed.data), Date.now());
  }
  markCompleted(step);
  return { ok: true };
}

export async function startImport(form: FormData): Promise<{ taskId: number } | { error: ImportError["code"] }> {
  const file = form.get("file");
  let text: string;
  try {
    if (file instanceof File && file.size > 0) {
      text = await extractText({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    } else {
      text = String(form.get("text") ?? "").slice(0, MAX_IMPORT_CHARS);
      if (text.replace(/\s+/g, "").length < MIN_TEXT) throw new ImportError("no_text");
    }
  } catch (err) {
    if (err instanceof ImportError) return { error: err.code };
    throw err;
  }
  return { taskId: enqueue(getDb(), { type: "extract_profile", payload: { text } }) };
}

/** Chamada quando a IA termina de preencher o perfil: conclui a etapa de importação. */
export async function recordImport(source: string): Promise<LastImport> {
  const last = { source: source.slice(0, 200), at: Date.now() };
  setSetting(getDb(), "onboarding.lastImport", last);
  markCompleted(1);
  return last;
}

export async function uploadCv(form: FormData): Promise<{ ok: true } | { ok: false; error: "not_pdf" | "too_large" }> {
  const file = form.get("cv");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".pdf")) return { ok: false, error: "not_pdf" };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "too_large" };
  const bytes = Buffer.from(await file.arrayBuffer());
  // Confere a assinatura do arquivo, não só a extensão.
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return { ok: false, error: "not_pdf" };

  const dir = join(process.env.DATA_DIR ?? "./data", "cv");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "cv.pdf");
  writeFileSync(path, bytes, { mode: 0o600 });

  const db = getDb();
  const current = getProfile(db)?.data ?? emptyProfile();
  saveProfile(db, { ...current, cvPath: path }, Date.now());
  return { ok: true };
}

export async function finishOnboarding(): Promise<{ ok: true } | { ok: false; missing: ReadinessGap[] }> {
  const db = getDb();
  const profile = getProfile(db)?.data ?? emptyProfile();
  const readiness = isSearchReady(profile);
  if (!readiness.ready) return { ok: false, missing: readiness.missing };
  // generate_queries dispara a primeira busca quando termina.
  enqueue(db, { type: "generate_queries", payload: {} });
  enqueue(db, { type: "generate_cover_letter", payload: {} });
  return { ok: true };
}
