import type { z } from "zod";
import { getDb, type Db } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { getSetting } from "@/server/settings";
import { createAnthropicProvider } from "./anthropic-provider";
import { createBridgeProvider } from "./bridge-provider";
import { LlmInvalidOutputError } from "./errors";
import { toStrictJsonSchema } from "./json-schema";
import { createOpenAiCompatibleProvider } from "./openai-compatible-provider";
import type { LlmProvider, LlmTask, ModelTier } from "./types";
import { assertUnderCap, recordUsage } from "./usage";

export function getProvider(db: Db, now: () => number): LlmProvider {
  const id = getSetting(db, "llm.provider");
  if (id === "anthropic") {
    const key = getSetting(db, "llm.anthropicApiKey") ?? getEnv().ANTHROPIC_API_KEY;
    if (!key) throw new Error("configure a chave da API da Anthropic em Configuração → IA");
    return createAnthropicProvider(key);
  }
  if (id === "openai-compatible") {
    const config = getSetting(db, "llm.openaiCompatible");
    if (!config) throw new Error("configure o endpoint OpenAI-compatible em Configuração → IA");
    return createOpenAiCompatibleProvider(config);
  }
  return createBridgeProvider(db, now);
}

export async function generateObject<T>(
  opts: { task: LlmTask; tier: ModelTier; system: string; input: string; schema: z.ZodType<T> },
  deps: { db?: Db; now?: () => number; provider?: LlmProvider } = {},
): Promise<T> {
  const db = deps.db ?? getDb();
  const now = deps.now ?? Date.now;
  assertUnderCap(db, now());
  const provider = deps.provider ?? getProvider(db, now);
  const res = await provider.generate({
    tier: opts.tier,
    system: opts.system,
    input: opts.input,
    jsonSchema: toStrictJsonSchema(opts.schema),
  });
  // A chamada custou cota mesmo se a saída for inválida: registra antes de validar.
  recordUsage(db, { task: opts.task, provider: provider.id, model: res.model, usage: res.usage, at: now() });
  const parsed = opts.schema.safeParse(res.object);
  if (!parsed.success) throw new LlmInvalidOutputError(parsed.error.issues);
  return parsed.data;
}
