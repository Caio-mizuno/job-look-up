import { z } from "zod";
import { withLlmDefer } from "@/server/tasks/llm-defer";
import { generateObject } from "./index";
import { TEST_SYSTEM } from "./prompts";

export const llmTestHandler = withLlmDefer(async (_task, { db, now }) =>
  generateObject(
    { task: "test", tier: "fast", system: TEST_SYSTEM, input: "Diga ok", schema: z.object({ ok: z.boolean() }) },
    { db, now },
  ),
);
