import type { LlmProviderId } from "@/server/settings";

export type ModelTier = "fast" | "smart";
export type LlmTask = "extract_profile" | "generate_queries" | "enrich" | "draft_answers" | "cover_letter" | "test";
export type LlmUsage = { inputTokens: number; outputTokens: number; costUsd: number | null };

export type LlmRequest = { tier: ModelTier; system: string; input: string; jsonSchema: object };
export type LlmResponse = { object: unknown; model: string; usage: LlmUsage };

export interface LlmProvider {
  id: LlmProviderId;
  generate(req: LlmRequest): Promise<LlmResponse>;
}
