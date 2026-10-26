"use server";

import { saveCoverLetter } from "@/server/cover-letter/generate";
import { getDb } from "@/server/db/client";
import { enqueue } from "@/server/tasks/queue";

export async function generateCoverLetterAction(): Promise<{ taskId: number }> {
  return { taskId: enqueue(getDb(), { type: "generate_cover_letter", payload: {} }) };
}

export async function saveCoverLetterAction(text: string): Promise<{ ok: true }> {
  saveCoverLetter(getDb(), String(text).slice(0, 10_000), Date.now());
  return { ok: true };
}
