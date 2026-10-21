import type { Db } from "@/server/db/client";
import { requeueStale } from "@/server/tasks/queue";

/** Worker reiniciado no meio de uma busca: nada fica preso em "Buscando…". */
export function recoverOnBoot(db: Db, now: number): void {
  db.$client.prepare("update search_runs set status = 'interrupted', finished_at = ? where status = 'running'").run(now);
  requeueStale(db, now, 0, "worker");
}
