import type { Db } from "@/server/db/client";
import { isSearchReady } from "@/server/profile/readiness";
import { getProfile } from "@/server/profile/repo";
import { getSetting } from "@/server/settings";
import { startSearchRun } from "./search-run";

/** Busca automática: roda a cada N horas enquanto os containers estão de pé. */
export function maybeScheduleSearch(db: Db, now: number): boolean {
  const hours = getSetting(db, "search.intervalHours");
  if (hours <= 0) return false;
  const profile = getProfile(db);
  if (!profile || !isSearchReady(profile.data).ready) return false;
  const last = db.$client.prepare("select status, started_at from search_runs order by id desc limit 1").get() as
    | { status: string; started_at: number }
    | undefined;
  if (last?.status === "running") return false;
  if (last && now - last.started_at < hours * 3_600_000) return false;
  startSearchRun(db, "schedule", now);
  return true;
}
