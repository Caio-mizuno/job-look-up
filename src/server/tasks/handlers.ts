import type { Db } from "@/server/db/client";
import { llmTestHandler } from "@/server/llm/test-handler";
import type { Task, TaskType } from "./queue";

export type Handler = (task: Task, ctx: { db: Db; now: () => number }) => Promise<unknown>;

/** Cada feature registra aqui o handler do seu tipo de tarefa. */
export const handlers: Partial<Record<TaskType, Handler>> = {
  llm_test: llmTestHandler,
};
