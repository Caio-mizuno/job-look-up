import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Contract, Seniority, WorkModel } from "@/server/domain/enums";

export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: integer().notNull(),
});

export const profile = sqliteTable("profile", {
  id: integer().primaryKey(),
  data: text({ mode: "json" }).notNull().$type<unknown>(),
  version: text().notNull(),
  updatedAt: integer().notNull(),
});

export const searchQueries = sqliteTable("search_queries", {
  id: integer().primaryKey({ autoIncrement: true }),
  keywords: text().notNull(),
  location: text(),
  origin: text().$type<"ai" | "user">().notNull(),
  enabled: integer({ mode: "boolean" }).notNull().default(true),
  createdAt: integer().notNull(),
});

export const sources = sqliteTable("sources", {
  id: text().primaryKey(),
  enabled: integer({ mode: "boolean" }).notNull(),
  status: text().$type<"idle" | "ok" | "limited" | "error">().notNull().default("idle"),
  lastError: text(),
  lastRunAt: integer(),
});

export type JobStatus = "new" | "seen" | "discarded" | "interested" | "applied" | "closed";

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    source: text().notNull(),
    sourceJobId: text(),
    url: text().notNull(),
    dedupeKey: text().notNull().unique(),
    title: text().notNull(),
    company: text(),
    location: text(),
    workModel: text().$type<WorkModel>(),
    contract: text().$type<Contract>(),
    seniority: text().$type<Seniority>(),
    salaryText: text(),
    postedAt: integer(),
    descriptionText: text(),
    localScore: real().notNull().default(0),
    status: text().$type<JobStatus>().notNull().default("new"),
    analysisError: text(),
    firstSeenAt: integer().notNull(),
    lastSeenAt: integer().notNull(),
    seenAt: integer(),
  },
  (t) => [index("jobs_status_idx").on(t.status), index("jobs_posted_at_idx").on(t.postedAt), index("jobs_local_score_idx").on(t.localScore)],
);

export const jobEnrichment = sqliteTable(
  "job_enrichment",
  {
    jobId: integer()
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    profileVersion: text().notNull(),
    matchScore: integer().notNull(),
    data: text({ mode: "json" }).notNull().$type<unknown>(),
    model: text().notNull(),
    createdAt: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.profileVersion] }), index("job_enrichment_match_idx").on(t.matchScore)],
);

export type ApplicationStatus =
  | "queued"
  | "running"
  | "login_required"
  | "needs_review"
  | "submitted"
  | "failed"
  | "cancelled";

export const applications = sqliteTable("applications", {
  id: integer().primaryKey({ autoIncrement: true }),
  jobId: integer()
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  status: text().$type<ApplicationStatus>().notNull(),
  taskId: integer(),
  drafts: text({ mode: "json" }).$type<unknown>(),
  extraAnswers: text({ mode: "json" }).notNull().$type<unknown[]>().default([]),
  events: text({ mode: "json" }).notNull().$type<unknown[]>().default([]),
  report: text({ mode: "json" }).$type<unknown>(),
  error: text(),
  createdAt: integer().notNull(),
  startedAt: integer(),
  finishedAt: integer(),
});

export type TaskStatus = "queued" | "running" | "done" | "failed";
export type TaskRunner = "worker" | "bridge";

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    type: text().notNull(),
    runner: text().$type<TaskRunner>().notNull().default("worker"),
    payload: text({ mode: "json" }).notNull().$type<unknown>(),
    result: text({ mode: "json" }).$type<unknown>(),
    status: text().$type<TaskStatus>().notNull().default("queued"),
    attempts: integer().notNull().default(0),
    runAt: integer().notNull(),
    lockedAt: integer(),
    error: text(),
    createdAt: integer().notNull(),
  },
  (t) => [index("tasks_claim_idx").on(t.status, t.runner, t.runAt)],
);

export const searchRuns = sqliteTable("search_runs", {
  id: integer().primaryKey({ autoIncrement: true }),
  status: text().$type<"running" | "done" | "interrupted">().notNull(),
  trigger: text().$type<"manual" | "schedule">().notNull(),
  perSource: text({ mode: "json" }).notNull().$type<Record<string, unknown>>().default({}),
  startedAt: integer().notNull(),
  finishedAt: integer(),
});

export const llmUsage = sqliteTable("llm_usage", {
  id: integer().primaryKey({ autoIncrement: true }),
  at: integer().notNull(),
  task: text().notNull(),
  provider: text().notNull(),
  model: text().notNull(),
  inputTokens: integer().notNull(),
  outputTokens: integer().notNull(),
  costUsd: real(),
});
