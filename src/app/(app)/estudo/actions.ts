"use server";

import { getDb } from "@/server/db/client";
import { enqueue } from "@/server/tasks/queue";

export async function generateStudyAction(): Promise<{ taskId: number }> {
  return { taskId: enqueue(getDb(), { type: "generate_study", payload: {} }) };
}
