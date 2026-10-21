import { syncApplicationsWithTasks } from "@/server/applications/sync";
import { getDb } from "@/server/db/client";
import { recoverOnBoot } from "@/server/pipeline/recover";
import { maybeScheduleSearch } from "@/server/pipeline/schedule";
import { handlers } from "@/server/tasks/handlers";
import { requeueStale } from "@/server/tasks/queue";
import { startWorker } from "@/server/worker/run-worker";

const db = getDb();
recoverOnBoot(db, Date.now());

const stop = startWorker({
  db,
  handlers,
  tick: (tickDb, now) => {
    requeueStale(tickDb, now);
    syncApplicationsWithTasks(tickDb);
    maybeScheduleSearch(tickDb, now);
  },
});

console.log("[worker] worker started");

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal}, finalizando…`);
    void stop().then(() => process.exit(0));
  });
}
