import { getDb } from "@/server/db/client";
import { handlers } from "@/server/tasks/handlers";
import { requeueStale } from "@/server/tasks/queue";
import { startWorker } from "@/server/worker/run-worker";

const db = getDb();
requeueStale(db, Date.now(), 0, "worker");

const stop = startWorker({
  db,
  handlers,
  tick: (tickDb, now) => {
    requeueStale(tickDb, now);
  },
});

console.log("[worker] worker started");

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[worker] ${signal}, finalizando…`);
    void stop().then(() => process.exit(0));
  });
}
