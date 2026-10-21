import { connection } from "next/server";
import { getDb, type Db } from "@/server/db/client";

/** Páginas que leem o banco são sempre dinâmicas: nada de prerender no build. */
export async function pageDb(): Promise<Db> {
  await connection();
  return getDb();
}
