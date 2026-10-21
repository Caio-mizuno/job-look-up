import { z } from "zod";
import { generateObject } from "@/server/llm/index";
import { EXTRACT_PROFILE_SYSTEM } from "@/server/llm/prompts";
import { mergeExtracted } from "@/server/profile/merge";
import { getProfile, saveProfile } from "@/server/profile/repo";
import { emptyProfile, ExtractedProfileSchema } from "@/server/profile/schema";
import { withLlmDefer } from "@/server/tasks/llm-defer";

const Payload = z.object({ text: z.string().min(1) });

export const extractProfileHandler = withLlmDefer(async (task, { db, now }) => {
  const { text } = Payload.parse(task.payload);
  const extracted = await generateObject(
    { task: "extract_profile", tier: "smart", system: EXTRACT_PROFILE_SYSTEM, input: text, schema: ExtractedProfileSchema },
    { db, now },
  );
  const current = getProfile(db)?.data ?? emptyProfile();
  saveProfile(db, mergeExtracted(current, extracted), now());
  return { ok: true };
});
