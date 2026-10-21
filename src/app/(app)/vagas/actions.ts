"use server";

import { getDb } from "@/server/db/client";
import { enqueue } from "@/server/tasks/queue";

/** Reanalisa uma vaga (botão "Recalcular" / "Tentar de novo" no card). */
export async function recalcJob(id: number): Promise<void> {
  const db = getDb();
  db.$client.prepare("update jobs set analysis_error = null where id = ?").run(id);
  enqueue(db, { type: "enrich", payload: { jobIds: [id] } });
}
