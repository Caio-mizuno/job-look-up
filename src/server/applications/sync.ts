import type { Db } from "@/server/db/client";

/** Ajudante ou worker reiniciado: o status da candidatura acompanha a tarefa real. */
export function syncApplicationsWithTasks(db: Db): void {
  db.$client
    .prepare(
      `update applications set status = 'queued', started_at = null
       where status = 'running' and task_id in (select id from tasks where status = 'queued')`,
    )
    .run();
  db.$client
    .prepare(
      `update applications set status = 'failed',
         error = (select coalesce(t.error, 'interrompida') from tasks t where t.id = applications.task_id),
         finished_at = coalesce(finished_at, strftime('%s','now') * 1000)
       where status in ('queued', 'running') and task_id in (select id from tasks where status = 'failed')`,
    )
    .run();
}
