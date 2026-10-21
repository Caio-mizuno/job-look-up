"use server";

import { z } from "zod";
import { answerUnanswered, cancelApplication, markSubmitted, retryApplication } from "@/server/applications/repo";
import { listApplications, type ApplicationListItem } from "@/server/applications/list";
import { getDb } from "@/server/db/client";

export async function fetchApplications(): Promise<ApplicationListItem[]> {
  return listApplications(getDb());
}

export async function markSubmittedAction(id: number): Promise<void> {
  markSubmitted(getDb(), id, Date.now());
}

export async function retryAction(id: number): Promise<void> {
  retryApplication(getDb(), id, Date.now());
}

export async function cancelAction(id: number): Promise<void> {
  cancelApplication(getDb(), id);
}

const Answers = z.array(z.object({ question: z.string().min(1).max(500), answer: z.string().max(2000), saveAsReady: z.boolean() })).max(50);

/** Responde o que faltou e já tenta de novo com as respostas novas. */
export async function answerUnansweredAction(id: number, raw: unknown): Promise<{ ok: boolean }> {
  const parsed = Answers.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const db = getDb();
  answerUnanswered(db, id, parsed.data, Date.now());
  retryApplication(db, id, Date.now());
  return { ok: true };
}
