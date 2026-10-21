import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/jobs/route";
import { setDb, type Db } from "@/server/db/client";
import { memDb } from "../../helpers/db";

let db: Db;
beforeEach(() => {
  db = memDb();
  setDb(db);
  db.$client
    .prepare(
      "insert into jobs (source, url, dedupe_key, title, work_model, status, first_seen_at, last_seen_at) values ('gupy','u1','k1','A','remote','new',0,0), ('gupy','u2','k2','B','onsite','new',0,0)",
    )
    .run();
});

describe("GET /api/jobs", () => {
  it("filters by csv params", async () => {
    const res = await GET(new Request("http://localhost/api/jobs?sort=match&workModels=onsite"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { items: { title: string }[] }).items.map((j) => j.title)).toEqual(["B"]);
  });

  it("400 on invalid values", async () => {
    expect((await GET(new Request("http://localhost/api/jobs?workModels=lua"))).status).toBe(400);
  });
});
