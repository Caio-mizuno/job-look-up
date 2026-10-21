import { z } from "zod";
import { ProfileSchema, type Profile } from "./schema";

const S = ProfileSchema.shape;

/** Que pedaço do perfil cada etapa edita (as etapas 0 e 1 não guardam dados). */
export const SECTION_SCHEMAS = {
  2: z.object({ personal: S.personal, headline: S.headline, summary: S.summary }),
  3: S.experiences,
  4: S.skills,
  5: z.object({ education: S.education, languages: S.languages }),
  6: S.preferences,
  7: S.readyAnswers,
} as const;

export type SectionStep = keyof typeof SECTION_SCHEMAS;

export function sectionOf(profile: Profile, step: SectionStep): unknown {
  switch (step) {
    case 2:
      return { personal: profile.personal, headline: profile.headline, summary: profile.summary };
    case 3:
      return profile.experiences;
    case 4:
      return profile.skills;
    case 5:
      return { education: profile.education, languages: profile.languages };
    case 6:
      return profile.preferences;
    case 7:
      return profile.readyAnswers;
  }
}

export function applySection(profile: Profile, step: SectionStep, data: unknown): Profile {
  switch (step) {
    case 2:
      return { ...profile, ...SECTION_SCHEMAS[2].parse(data) };
    case 3:
      return { ...profile, experiences: SECTION_SCHEMAS[3].parse(data) };
    case 4:
      return { ...profile, skills: SECTION_SCHEMAS[4].parse(data) };
    case 5:
      return { ...profile, ...SECTION_SCHEMAS[5].parse(data) };
    case 6:
      return { ...profile, preferences: SECTION_SCHEMAS[6].parse(data) };
    case 7:
      return { ...profile, readyAnswers: SECTION_SCHEMAS[7].parse(data) };
  }
}
