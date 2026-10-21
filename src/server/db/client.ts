import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

function migrationsFolder(): string {
  // No container o cwd é /app e as migrations ficam em /app/drizzle; em dev/teste, na raiz do repo.
  return resolve(process.env.MIGRATIONS_DIR ?? join(process.cwd(), "drizzle"));
}

export function createDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const client = new Database(file);
  client.pragma("journal_mode = WAL");
  // app e worker abrem o mesmo arquivo; espera o lock em vez de falhar na hora.
  client.pragma("busy_timeout = 5000");
  client.pragma("foreign_keys = ON");
  const db = drizzle({ client, schema, casing: "snake_case" }) as Db;
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

let singleton: Db | null = null;

export function getDb(): Db {
  if (!singleton) {
    const dataDir = process.env.DATA_DIR ?? "./data";
    singleton = createDb(join(dataDir, "app.db"));
  }
  return singleton;
}

/** Só para testes: troca o singleton por um banco em memória. */
export function setDb(db: Db): void {
  singleton = db;
}
