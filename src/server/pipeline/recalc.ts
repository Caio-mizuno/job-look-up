import type { Db } from "@/server/db/client";
import { getSetting } from "@/server/settings";
import { enqueue } from "@/server/tasks/queue";
import { ENRICH_BATCH } from "./search-run";

/** Perfil mudou: reanalisa só as top-K pela nota local e as vagas marcadas como interesse. */
export function scheduleRecalc(db: Db, version: string): number {
  const topK = getSetting(db, "search.topK");
  const rows = db.$client
    .prepare(
      `select id from (
         select id from jobs where status not in ('discarded') order by local_score desc, id desc limit ?
       )
       union
       select id from jobs where status = 'interested'`,
    )
    .all(topK) as { id: number }[];
  const done = new Set(
    (db.$client.prepare("select job_id from job_enrichment where profile_version = ?").all(version) as { job_id: number }[]).map(
      (r) => r.job_id,
    ),
  );
  const ids = rows.map((r) => r.id).filter((id) => !done.has(id));
  let batches = 0;
  for (let i = 0; i < ids.length; i += ENRICH_BATCH) {
    enqueue(db, { type: "enrich", payload: { jobIds: ids.slice(i, i + ENRICH_BATCH) } });
    batches++;
  }
  return batches;
}
