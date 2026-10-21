import { z } from "zod";
import type { ExtractedProfile, Profile } from "./schema";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const isEmail = (s: string) => z.email().safeParse(s).success;
const pick = (current: string, incoming: string) => (current.trim() ? current : incoming.trim());

/** Junta o que a IA extraiu sem sobrescrever nada que a pessoa já preencheu. */
export function mergeExtracted(current: Profile, extracted: ExtractedProfile): Profile {
  const personal = { ...current.personal };
  for (const key of Object.keys(personal) as (keyof Profile["personal"])[]) {
    const incoming = extracted.personal[key] ?? "";
    if (key === "email" && incoming && !isEmail(incoming.trim())) continue;
    personal[key] = pick(personal[key], incoming);
  }

  const expKey = (e: { company: string; title: string }) => `${norm(e.company)}|${norm(e.title)}`;
  const seenExp = new Set(current.experiences.map(expKey));
  const experiences = [...current.experiences];
  for (const e of extracted.experiences) {
    if (seenExp.has(expKey(e))) continue;
    seenExp.add(expKey(e));
    experiences.push(e);
  }

  const seenSkill = new Set(current.skills.map((s) => norm(s.name)));
  const skills = [...current.skills];
  for (const s of extracted.skills) {
    if (!s.name.trim() || seenSkill.has(norm(s.name))) continue;
    seenSkill.add(norm(s.name));
    skills.push(s);
  }

  const prefs = current.preferences;
  const ex = extracted.preferences;
  return {
    ...current,
    personal,
    headline: pick(current.headline, extracted.headline),
    summary: pick(current.summary, extracted.summary),
    experiences,
    skills,
    education: current.education.length ? current.education : extracted.education,
    languages: current.languages.length ? current.languages : extracted.languages,
    preferences: {
      ...prefs,
      roles: prefs.roles.length ? prefs.roles : ex.roles,
      seniorities: prefs.seniorities.length ? prefs.seniorities : ex.seniorities,
      workModels: prefs.workModels.length ? prefs.workModels : ex.workModels,
      contracts: prefs.contracts.length ? prefs.contracts : ex.contracts,
      locations: prefs.locations.length ? prefs.locations : ex.locations,
      salaryMin: prefs.salaryMin ?? ex.salaryMin,
    },
  };
}
