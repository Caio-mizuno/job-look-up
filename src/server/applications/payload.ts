import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Db } from "@/server/db/client";
import { getProfile } from "@/server/profile/repo";
import { emptyProfile } from "@/server/profile/schema";
import { buildCompanyMessage } from "./message";
import { getApplication } from "./repo";
import type { ApplyPayload, Drafts } from "./schema";

export { isAutoApplyAllowed } from "@/lib/apply-url";

/** Rascunhos da IA quando existem; sem mensagem da IA, entra a mensagem genérica. */
function withMessage(drafts: Partial<Drafts> | null, msg: Parameters<typeof buildCompanyMessage>[0]): Drafts {
  return {
    pitch: drafts?.pitch ?? "",
    whyCompany: drafts?.whyCompany ?? "",
    message: drafts?.message?.trim() ? drafts.message : buildCompanyMessage(msg),
  };
}

export function buildApplyPayload(db: Db, applicationId: number): ApplyPayload {
  const app = getApplication(db, applicationId);
  if (!app) throw new Error(`candidatura ${applicationId} não existe`);
  const job = db.$client.prepare("select url, title, company from jobs where id = ?").get(app.jobId) as {
    url: string;
    title: string;
    company: string | null;
  };
  const p = getProfile(db)?.data ?? emptyProfile();

  // Respostas que a pessoa deu nesta candidatura valem mais que as prontas.
  const answers = new Map<string, { question: string; answer: string }>();
  for (const a of p.readyAnswers) if (a.answer.trim()) answers.set(a.question.trim().toLowerCase(), a);
  for (const a of app.extraAnswers) if (a.answer.trim()) answers.set(a.question.trim().toLowerCase(), { question: a.question, answer: a.answer });

  const cv = p.cvPath && existsSync(p.cvPath)
    ? { filename: basename(p.cvPath), base64: readFileSync(p.cvPath).toString("base64") }
    : null;

  return {
    applicationId,
    jobUrl: job.url,
    jobTitle: job.title,
    company: job.company,
    profile: {
      personal: p.personal,
      headline: p.headline,
      summary: p.summary,
      experiences: p.experiences,
      education: p.education,
      languages: p.languages,
      skills: p.skills,
    },
    readyAnswers: [...answers.values()],
    drafts: withMessage(app.drafts as Partial<Drafts> | null, {
      name: p.personal.name,
      headline: p.headline,
      skills: p.skills.map((s) => s.name),
      jobTitle: job.title,
      company: job.company,
      linkedin: p.personal.linkedin,
    }),
    cv,
  };
}
