import { createHash } from "node:crypto";
import type { Db } from "@/server/db/client";
import { ProfileSchema, type Profile } from "./schema";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** Hash do conteúdo: muda só quando o perfil muda de fato (independe da ordem das chaves). */
export function profileVersion(data: Profile): string {
  return createHash("sha256").update(JSON.stringify(canonical(data))).digest("hex").slice(0, 16);
}

export function getProfile(db: Db): { data: Profile; version: string } | null {
  const row = db.$client.prepare("select data, version from profile where id = 1").get() as
    | { data: string; version: string }
    | undefined;
  if (!row) return null;
  return { data: ProfileSchema.parse(JSON.parse(row.data)), version: row.version };
}

export function saveProfile(db: Db, data: Profile, now: number): { version: string; changed: boolean } {
  const parsed = ProfileSchema.parse(data);
  const version = profileVersion(parsed);
  const previous = db.$client.prepare("select version from profile where id = 1").get() as { version: string } | undefined;
  db.$client
    .prepare(
      `insert into profile (id, data, version, updated_at) values (1, ?, ?, ?)
       on conflict(id) do update set data = excluded.data, version = excluded.version, updated_at = excluded.updated_at`,
    )
    .run(JSON.stringify(parsed), version, now);
  return { version, changed: previous?.version !== version };
}
