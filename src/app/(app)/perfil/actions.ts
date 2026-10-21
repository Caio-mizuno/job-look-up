"use server";

import { getDb } from "@/server/db/client";
import { getProfile, saveProfile } from "@/server/profile/repo";
import { ProfileSchema } from "@/server/profile/schema";

export async function saveFullProfile(
  raw: unknown,
): Promise<{ ok: true; changed: boolean } | { ok: false; errors: { path: string; message: string }[] }> {
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  }
  const db = getDb();
  // O caminho do CV é do servidor; o cliente só sabe se existe.
  const cvPath = getProfile(db)?.data.cvPath ?? null;
  const { changed } = saveProfile(db, { ...parsed.data, cvPath }, Date.now());
  return { ok: true, changed };
}
