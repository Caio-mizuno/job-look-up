import type { Profile } from "./schema";

export type ReadinessGap = "name" | "email" | "experienceOrSkill" | "preferences";

/** O mínimo para a busca fazer sentido (spec §6): nome, e-mail, alguma experiência ou habilidade e preferências. */
export function isSearchReady(p: Profile): { ready: boolean; missing: ReadinessGap[] } {
  const missing: ReadinessGap[] = [];
  if (!p.personal.name.trim()) missing.push("name");
  if (!p.personal.email.trim()) missing.push("email");
  if (p.experiences.length === 0 && p.skills.length === 0) missing.push("experienceOrSkill");
  if (p.preferences.roles.length === 0 || p.preferences.workModels.length === 0) missing.push("preferences");
  return { ready: missing.length === 0, missing };
}
