import { beforeEach, describe, expect, it } from "vitest";
import { saveSearchQueries } from "@/app/(app)/vagas/search-actions";
import { setDb, type Db } from "@/server/db/client";
import { listQueries } from "@/server/pipeline/queries";
import { memDb } from "../helpers/db";

let db: Db;

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
  db = memDb();
  setDb(db);
});

describe("saveSearchQueries", () => {
  it("refuses a profile link as keywords", async () => {
    const res = await saveSearchQueries([{ keywords: "https://www.linkedin.com/in/caio-mizuno/", location: null }]);
    expect(res).toEqual({ ok: false, error: "Use cargo ou tecnologia (ex.: desenvolvedor react), não link nem e-mail." });
    expect(listQueries(db)).toEqual([]);
  });

  it("saves roles and technologies", async () => {
    expect(await saveSearchQueries([{ keywords: "desenvolvedor laravel", location: "Remoto" }])).toEqual({ ok: true });
    expect(listQueries(db)).toEqual([{ keywords: "desenvolvedor laravel", location: "Remoto", origin: "user" }]);
  });
});
