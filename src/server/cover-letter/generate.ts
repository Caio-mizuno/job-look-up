import { z } from "zod";
import type { Db } from "@/server/db/client";
import { generateObject } from "@/server/llm/index";
import { COVER_LETTER_SYSTEM } from "@/server/llm/prompts";
import { getProfile } from "@/server/profile/repo";
import type { Profile } from "@/server/profile/schema";
import { getSetting, setSetting, type CoverLetter } from "@/server/settings";
import { withLlmDefer } from "@/server/tasks/llm-defer";

const CoverLetterSchema = z.object({ letter: z.string().min(1).max(5000) });

function profileForPrompt(p: Profile): string {
  const { name, phone, email, city, state, linkedin, github, portfolio } = p.personal;
  return JSON.stringify({
    pessoa: { name, phone, email, city, state, linkedin, github, portfolio },
    headline: p.headline,
    resumo: p.summary,
    experiencias: p.experiences.map((e) => ({
      cargo: e.title,
      empresa: e.company,
      inicio: e.start,
      fim: e.end,
      descricao: e.description.slice(0, 600),
      tecnologias: e.technologies,
    })),
    habilidades: p.skills.map((s) => s.name),
    formacao: p.education.map((e) => `${e.course} — ${e.institution}`),
    idiomas: p.languages.map((l) => `${l.language} (${l.level})`),
    procura: { cargos: p.preferences.roles, senioridades: p.preferences.seniorities, modelos: p.preferences.workModels },
  });
}

export function getCoverLetter(db: Db): CoverLetter | null {
  return getSetting(db, "profile.coverLetter");
}

export function saveCoverLetter(db: Db, text: string, now: number): CoverLetter {
  const letter = { text: text.trim(), updatedAt: now };
  setSetting(db, "profile.coverLetter", letter);
  return letter;
}

/** Gera a carta a partir do perfil atual e substitui a anterior. */
export const generateCoverLetterHandler = withLlmDefer(async (_task, { db, now }) => {
  const profile = getProfile(db)?.data;
  if (!profile) return { skipped: "sem perfil" };
  const { letter } = await generateObject(
    { task: "cover_letter", tier: "smart", system: COVER_LETTER_SYSTEM, input: profileForPrompt(profile), schema: CoverLetterSchema },
    { db, now },
  );
  const saved = saveCoverLetter(db, letter, now());
  return { ok: true, text: saved.text };
});
