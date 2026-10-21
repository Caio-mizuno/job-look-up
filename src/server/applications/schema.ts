import { z } from "zod";
import type { Profile } from "@/server/profile/schema";

export const ApplyReportSchema = z.object({
  status: z.enum(["needs_review", "login_required", "blocked", "error"]),
  filled: z.array(z.string()),
  drafted: z.array(z.string()),
  unanswered: z.array(z.string()),
  notes: z.string(),
});
export type ApplyReport = z.infer<typeof ApplyReportSchema>;

export const DraftsSchema = z.object({ pitch: z.string().max(600), whyCompany: z.string().max(600) });
export type Drafts = z.infer<typeof DraftsSchema>;

export const ApplyEventSchema = z.object({
  at: z.number(),
  kind: z.enum(["text", "tool", "status"]),
  text: z.string(),
});
export type ApplyEvent = z.infer<typeof ApplyEventSchema>;

export type ExtraAnswer = { question: string; answer: string; saveAsReady?: boolean };

export type ApplyPayload = {
  applicationId: number;
  jobUrl: string;
  jobTitle: string;
  company: string | null;
  profile: Pick<Profile, "personal" | "headline" | "summary" | "experiences" | "education" | "languages" | "skills">;
  readyAnswers: { question: string; answer: string }[];
  drafts: Drafts;
  cv: { filename: string; base64: string } | null;
};
