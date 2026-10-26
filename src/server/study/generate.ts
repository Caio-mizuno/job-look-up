import { z } from "zod";
import type { Db } from "@/server/db/client";
import { generateObject } from "@/server/llm/index";
import { STUDY_SYSTEM } from "@/server/llm/prompts";
import { getProfile } from "@/server/profile/repo";
import type { Profile } from "@/server/profile/schema";
import { getSetting, setSetting } from "@/server/settings";
import { withLlmDefer } from "@/server/tasks/llm-defer";
import { techStats, type ThemeStat, type TechStats } from "./stats";

/** Só os temas mais pedidos: o material não vira livro. */
export const MAX_STUDY_THEMES = 8;
const MAX_TECHS_PER_THEME = 8;

const TopicSchema = z.object({
  themeId: z.string(),
  summary: z.string(),
  concepts: z.array(z.string()),
  options: z.array(z.object({ name: z.string(), whenToUse: z.string() })),
  steps: z.array(z.string()),
  interview: z.array(z.string()),
  exercise: z.string(),
  docs: z.array(z.string()),
});
const StudySchema = z.object({ topics: z.array(TopicSchema).min(1) });

export type StudyTopic = z.infer<typeof TopicSchema> & { theme: ThemeStat };
/** Material salvo com o retrato das contagens que a IA recebeu. */
export type StudyPlan = { topics: StudyTopic[]; totalJobs: number; updatedAt: number };

function inputForPrompt(stats: TechStats, themes: ThemeStat[], p: Profile): string {
  return JSON.stringify({
    vagasNaListagem: stats.totalJobs,
    temas: themes.map((t) => ({
      id: t.id,
      tema: t.label,
      vagas: t.jobs,
      prioridade: t.priority,
      tecnologias: t.techs.slice(0, MAX_TECHS_PER_THEME).map((x) => ({ nome: x.name, vagas: x.jobs, noPerfil: x.inProfile })),
    })),
    perfil: {
      headline: p.headline,
      senioridades: p.preferences.seniorities,
      habilidades: p.skills.map((s) => (s.years ? `${s.name} (${s.years} anos)` : s.name)),
      tecnologiasNasExperiencias: [...new Set(p.experiences.flatMap((e) => e.technologies))],
    },
  });
}

export function getStudyPlan(db: Db): StudyPlan | null {
  return getSetting(db, "study.plan");
}

/** Conta as tecnologias da listagem atual e pede à IA o material dos temas mais pedidos. */
export const generateStudyHandler = withLlmDefer(async (_task, { db, now }) => {
  const profile = getProfile(db)?.data;
  if (!profile) return { skipped: "sem perfil" };
  const stats = techStats(db, profile);
  const themes = stats.themes.slice(0, MAX_STUDY_THEMES);
  if (!themes.length) return { skipped: "sem tecnologias nas vagas" };

  const { topics } = await generateObject(
    { task: "study", tier: "smart", system: STUDY_SYSTEM, input: inputForPrompt(stats, themes, profile), schema: StudySchema },
    { db, now },
  );
  // Tema que a IA inventou ou repetiu fica de fora; a ordem segue a contagem.
  const byId = new Map(topics.map((t) => [t.themeId, t] as const));
  const plan: StudyPlan = {
    topics: themes.flatMap((theme) => {
      const t = byId.get(theme.id);
      return t ? [{ ...t, theme }] : [];
    }),
    totalJobs: stats.totalJobs,
    updatedAt: now(),
  };
  setSetting(db, "study.plan", plan);
  return { ok: true, plan };
});
