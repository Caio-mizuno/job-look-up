import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, type Db } from "@/server/db/client";

export function memDb(): Db {
  return createDb(":memory:");
}

export function tmpFile(name = "test.db"): string {
  return join(mkdtempSync(join(tmpdir(), "jl-")), name);
}
