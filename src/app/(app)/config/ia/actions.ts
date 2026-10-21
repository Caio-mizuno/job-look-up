"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { getSetting, setSetting } from "@/server/settings";
import { enqueue } from "@/server/tasks/queue";

const Input = z.object({
  provider: z.enum(["claude-code", "anthropic", "openai-compatible"]),
  anthropicApiKey: z.string().trim().optional(),
  openai: z
    .object({ baseUrl: z.url(), model: z.string().trim().min(1), apiKey: z.string().trim().optional() })
    .optional(),
  dailyCallCap: z.coerce.number().int().min(0).max(100_000),
});

export async function saveLlmSettings(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "dados inválidos" };
  const db = getDb();
  const input = parsed.data;

  // Valida antes de gravar: um provedor sem chave/endpoint nunca vira o ativo.
  if (input.provider === "anthropic" && !input.anthropicApiKey && !getSetting(db, "llm.anthropicApiKey") && !process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "informe a chave da API da Anthropic" };
  }
  if (input.provider === "openai-compatible" && !input.openai && !getSetting(db, "llm.openaiCompatible")) {
    return { ok: false, error: "informe a base URL e o modelo" };
  }

  // Campo de chave vazio = manter a chave já salva.
  if (input.anthropicApiKey) setSetting(db, "llm.anthropicApiKey", input.anthropicApiKey);
  if (input.openai) {
    const previous = getSetting(db, "llm.openaiCompatible");
    setSetting(db, "llm.openaiCompatible", {
      baseUrl: input.openai.baseUrl,
      model: input.openai.model,
      apiKey: input.openai.apiKey || previous?.apiKey || "",
    });
  }
  setSetting(db, "llm.dailyCallCap", input.dailyCallCap);
  setSetting(db, "llm.provider", input.provider);
  refresh();
  return { ok: true };
}

export async function testLlm(): Promise<{ taskId: number }> {
  return { taskId: enqueue(getDb(), { type: "llm_test", payload: {} }) };
}
