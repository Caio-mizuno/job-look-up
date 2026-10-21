import type { Contract, WorkModel } from "@/server/domain/enums";
import type { Preferences, Profile } from "@/server/profile/schema";
import { normalizeText } from "@/server/sources/match";
import { SKILL_ALIASES } from "./skill-aliases";

const DAY = 86_400_000;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function profileSkills(profile: Profile): string[] {
  const names = new Map<string, string>();
  for (const s of profile.skills) if (s.name.trim()) names.set(normalizeText(s.name.trim()), s.name.trim());
  for (const e of profile.experiences)
    for (const t of e.technologies) if (t.trim()) names.set(normalizeText(t.trim()), t.trim());
  return [...names.keys()];
}

function mentions(haystack: string, skill: string): boolean {
  const terms = [skill, ...(SKILL_ALIASES[skill] ?? [])];
  return terms.some((term) => new RegExp(`(^|[^a-z0-9])${escapeRe(normalizeText(term))}([^a-z0-9]|$)`).test(haystack));
}

/** Nota barata (sem IA) só para escolher quais vagas valem a análise da IA. */
export function localScore(
  job: { title: string; descriptionText: string | null; postedAt: number | null },
  profile: Profile,
  now: number,
): number {
  const skills = profileSkills(profile);
  const hay = normalizeText(`${job.title}\n${job.descriptionText ?? ""}`);
  const hits = skills.filter((s) => mentions(hay, s)).length;
  const skillPart = Math.round(85 * Math.min(1, hits / Math.max(5, skills.length)));
  let recency = 0;
  if (job.postedAt !== null) {
    const age = now - job.postedAt;
    recency = age <= 3 * DAY ? 15 : age <= 7 * DAY ? 10 : age <= 30 * DAY ? 5 : 0;
  }
  return Math.min(100, skillPart + recency);
}

/** Só descarta quando a vaga deixa claro que contradiz o que a pessoa quer. */
export function passesPreferences(
  job: { workModel: WorkModel | null; contract: Contract | null; location: string | null },
  prefs: Preferences,
): boolean {
  if (job.workModel && prefs.workModels.length > 0 && !prefs.workModels.includes(job.workModel)) return false;
  if (job.contract && job.contract !== "other" && prefs.contracts.length > 0 && !prefs.contracts.includes(job.contract))
    return false;
  if (
    (job.workModel === "onsite" || job.workModel === "hybrid") &&
    prefs.locations.length > 0 &&
    !prefs.willingToRelocate
  ) {
    const where = normalizeText(job.location ?? "");
    if (!prefs.locations.some((loc) => where.includes(normalizeText(loc)))) return false;
  }
  return true;
}
