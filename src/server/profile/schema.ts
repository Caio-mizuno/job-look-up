import { z } from "zod";
import { ContractEnum, SeniorityEnum, WorkModelEnum } from "@/server/domain/enums";
import { DEFAULT_READY_QUESTIONS } from "./default-answers";

const personalShape = {
  name: z.string(),
  phone: z.string(),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  linkedin: z.string(),
  github: z.string(),
  portfolio: z.string(),
};

export const ExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  start: z.string(),
  end: z.string().nullable(),
  workModel: WorkModelEnum.nullable(),
  description: z.string(),
  technologies: z.array(z.string()),
});

export const SkillSchema = z.object({
  name: z.string(),
  years: z.number().nullable(),
  level: z.enum(["basico", "intermediario", "avancado"]).nullable(),
});

export const EducationSchema = z.object({
  course: z.string(),
  institution: z.string(),
  start: z.string(),
  end: z.string(),
});

export const LanguageSchema = z.object({ language: z.string(), level: z.string() });

export const PreferencesSchema = z.object({
  roles: z.array(z.string()),
  seniorities: z.array(SeniorityEnum),
  workModels: z.array(WorkModelEnum),
  contracts: z.array(ContractEnum),
  salaryMin: z.number().nullable(),
  currency: z.enum(["BRL", "USD", "EUR"]),
  locations: z.array(z.string()),
  willingToRelocate: z.boolean(),
  availability: z.string(),
});

const contentShape = {
  headline: z.string(),
  summary: z.string(),
  experiences: z.array(ExperienceSchema),
  skills: z.array(SkillSchema),
  education: z.array(EducationSchema),
  languages: z.array(LanguageSchema),
  preferences: PreferencesSchema,
};

/** O que a IA devolve ao ler um currículo: tudo obrigatório, vazio quando não aparece. */
export const ExtractedProfileSchema = z.object({
  personal: z.object({ ...personalShape, email: z.string() }),
  ...contentShape,
});

export const ProfileSchema = z.object({
  personal: z.object({ ...personalShape, email: z.union([z.literal(""), z.email()]) }),
  ...contentShape,
  readyAnswers: z.array(z.object({ question: z.string(), answer: z.string() })),
  cvPath: z.string().nullable(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type ExtractedProfile = z.infer<typeof ExtractedProfileSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;

export function emptyProfile(): Profile {
  return {
    personal: { name: "", email: "", phone: "", city: "", state: "", country: "", linkedin: "", github: "", portfolio: "" },
    headline: "",
    summary: "",
    experiences: [],
    skills: [],
    education: [],
    languages: [],
    preferences: {
      roles: [],
      seniorities: [],
      workModels: [],
      contracts: [],
      salaryMin: null,
      currency: "BRL",
      locations: [],
      willingToRelocate: false,
      availability: "",
    },
    readyAnswers: DEFAULT_READY_QUESTIONS.map((question) => ({ question, answer: "" })),
    cvPath: null,
  };
}
