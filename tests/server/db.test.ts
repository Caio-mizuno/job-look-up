import { describe, expect, it } from "vitest";
import { createDb } from "@/server/db/client";
import { tmpFile } from "../helpers/db";

describe("createDb", () => {
  it("migrates all tables", () => {
    const db = createDb(":memory:");
    const names = (db.$client.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]).map(
      (r) => r.name,
    );
    for (const t of [
      "settings",
      "profile",
      "search_queries",
      "sources",
      "jobs",
      "job_enrichment",
      "applications",
      "tasks",
      "search_runs",
      "llm_usage",
    ]) {
      expect(names).toContain(t);
    }
  });

  it("uses WAL on file db", () => {
    const db = createDb(tmpFile());
    expect(db.$client.pragma("journal_mode", { simple: true })).toBe("wal");
  });

  it("enforces unique dedupe_key on jobs", () => {
    const db = createDb(":memory:");
    const insert = db.$client.prepare(
      "insert into jobs (source, url, dedupe_key, title, first_seen_at, last_seen_at) values ('gupy', ?, 'k1', 'Dev', 0, 0)",
    );
    insert.run("https://a.com/1");
    expect(() => insert.run("https://a.com/2")).toThrow();
  });
});
