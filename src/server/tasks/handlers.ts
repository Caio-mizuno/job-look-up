import { draftAnswersHandler, prepareApplyHandler } from "@/server/applications/drafts";
import { generateCoverLetterHandler } from "@/server/cover-letter/generate";
import type { Db } from "@/server/db/client";
import { extractProfileHandler } from "@/server/import/extract-profile";
import { llmTestHandler } from "@/server/llm/test-handler";
import { enrichHandler } from "@/server/pipeline/enrich";
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
  enrich: enrichHandler,
  prepare_apply: prepareApplyHandler,
  draft_answers: draftAnswersHandler,
  generate_cover_letter: generateCoverLetterHandler,
};
