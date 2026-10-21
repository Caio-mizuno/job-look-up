"use server";

import { getDb } from "@/server/db/client";
import { setJobStatus } from "@/server/jobs/list";
import { enqueue } from "@/server/tasks/queue";

/** Reanalisa uma vaga (botão "Recalcular" / "Tentar de novo" no card). */
export async function recalcJob(id: number): Promise<void> {
  const db = getDb();
  db.$client.prepare("update jobs set analysis_error = null where id = ?").run(id);
  enqueue(db, { type: "enrich", payload: { jobIds: [id] } });
}

export async function markSeen(id: number): Promise<void> {
  const db = getDb();
  // Só sai de "nova"; interesse/candidatura não voltam para "vista".
  const row = db.$client.prepare("select status from jobs where id = ?").get(id) as { status: string } | undefined;
  if (row?.status === "new") setJobStatus(db, id, "seen", Date.now());
}

export async function discardJob(id: number): Promise<void> {
  setJobStatus(getDb(), id, "discarded", Date.now());
}

export async function restoreJob(id: number): Promise<void> {
  setJobStatus(getDb(), id, "seen", Date.now());
}
