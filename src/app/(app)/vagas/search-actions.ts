"use server";

import { isUsableKeywords, KEYWORDS_LINK_ERROR } from "@/lib/search-keywords";
import { getDb } from "@/server/db/client";
import { clearQueries, saveQueries } from "@/server/pipeline/queries";
import { startSearchRun } from "@/server/pipeline/search-run";
import { enqueue } from "@/server/tasks/queue";
import { z } from "zod";

export async function startSearch(): Promise<{ runId: number }> {
  return { runId: startSearchRun(getDb(), "manual", Date.now()) };
}

const Queries = z
  .array(
    z.object({
      keywords: z.string().trim().min(2).max(120).refine(isUsableKeywords, KEYWORDS_LINK_ERROR),
      location: z.string().trim().max(80).nullable(),
    }),
  )
  .max(6);

export async function saveSearchQueries(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = Queries.safeParse(raw);
  if (!parsed.success) {
    const link = parsed.error.issues.some((i) => i.message === KEYWORDS_LINK_ERROR);
    return { ok: false, error: link ? KEYWORDS_LINK_ERROR : "cada consulta precisa de 2 a 120 caracteres (máximo 6)" };
  }
  saveQueries(getDb(), parsed.data.map((q) => ({ keywords: q.keywords, location: q.location || null })), Date.now());
  return { ok: true };
}

/** Volta para as consultas da IA: apaga as atuais e gera de novo (o que também dispara uma busca). */
export async function regenerateQueries(): Promise<{ ok: true }> {
  const db = getDb();
  clearQueries(db);
  enqueue(db, { type: "generate_queries", payload: {} });
  return { ok: true };
}
