import type { Db } from "@/server/db/client";
import { extractProfileHandler } from "@/server/import/extract-profile";
import { llmTestHandler } from "@/server/llm/test-handler";
import { generateQueriesHandler } from "@/server/pipeline/queries";
import { searchRunHandler } from "@/server/pipeline/search-run";
import type { Task, TaskType } from "./queue";

export type Handler = (task: Task, ctx: { db: Db; now: () => number }) => Promise<unknown>;

/** Cada feature registra aqui o handler do seu tipo de tarefa. */
export const handlers: Partial<Record<TaskType, Handler>> = {
  llm_test: llmTestHandler,
  extract_profile: extractProfileHandler,
  generate_queries: generateQueriesHandler,
  search_run: searchRunHandler,
};
