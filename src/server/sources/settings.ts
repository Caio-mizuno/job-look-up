import type { Db } from "@/server/db/client";
import { SOURCES } from "./registry";
import type { JobSource, SourceId } from "./types";

export type SourceStatus = "idle" | "ok" | "limited" | "error";
export type SourceState = {
  id: SourceId;
  label: string;
  homepage: string;
  defaultEnabled: boolean;
  enabled: boolean;
  status: SourceStatus;
  lastError: string | null;
  lastRunAt: number | null;
};

type Row = { id: string; enabled: number; status: SourceStatus; last_error: string | null; last_run_at: number | null };

export function getSourceStates(db: Db): SourceState[] {
  const rows = new Map(
    (db.$client.prepare("select * from sources").all() as Row[]).map((r) => [r.id, r] as const),
  );
  return SOURCES.map((s) => {
    const r = rows.get(s.id);
    return {
      id: s.id,
      label: s.label,
      homepage: s.homepage,
      defaultEnabled: s.defaultEnabled,
      enabled: r ? r.enabled === 1 : s.defaultEnabled,
      status: r?.status ?? "idle",
      lastError: r?.last_error ?? null,
      lastRunAt: r?.last_run_at ?? null,
    };
  });
}

function ensureRow(db: Db, id: SourceId) {
  const src = SOURCES.find((s) => s.id === id);
  db.$client
    .prepare("insert into sources (id, enabled, status) values (?, ?, 'idle') on conflict(id) do nothing")
    .run(id, src?.defaultEnabled ? 1 : 0);
}

export function setSourceEnabled(db: Db, id: SourceId, enabled: boolean): void {
  ensureRow(db, id);
  db.$client.prepare("update sources set enabled = ? where id = ?").run(enabled ? 1 : 0, id);
}

export function updateSourceStatus(db: Db, id: SourceId, status: SourceStatus, error: string | null, now: number): void {
  ensureRow(db, id);
  db.$client
    .prepare("update sources set status = ?, last_error = ?, last_run_at = ? where id = ?")
    .run(status, error, now, id);
}

export function enabledSources(db: Db): JobSource[] {
  const on = new Set(getSourceStates(db).filter((s) => s.enabled).map((s) => s.id));
  return SOURCES.filter((s) => on.has(s.id));
}

/** Ids das fontes ligadas em JSON, para `source in (select value from json_each(?))`: lista vazia vira filtro vazio. */
export function enabledSourceIdsJson(db: Db): string {
  return JSON.stringify(enabledSources(db).map((s) => s.id));
}
