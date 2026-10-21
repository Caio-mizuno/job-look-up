import type { Metadata } from "next";
import { usageThisMonth } from "@/server/llm/usage";
import { pageDb } from "@/server/page-db";
import { getSetting } from "@/server/settings";
import { LlmSettingsForm } from "./llm-settings-form";

export const metadata: Metadata = { title: "IA" };

const last4 = (key: string | null | undefined) => (key ? key.slice(-4) : null);

export default async function IaPage() {
  const db = await pageDb();
  const openai = getSetting(db, "llm.openaiCompatible");
  const usage = usageThisMonth(db);
  return (
    <LlmSettingsForm
      initial={{
        provider: getSetting(db, "llm.provider"),
        anthropicKeyLast4: last4(getSetting(db, "llm.anthropicApiKey")),
        openai: openai ? { baseUrl: openai.baseUrl, model: openai.model, apiKeyLast4: last4(openai.apiKey) } : null,
        dailyCallCap: getSetting(db, "llm.dailyCallCap"),
        usage: { calls: usage.calls, tokens: usage.inputTokens + usage.outputTokens },
      }}
    />
  );
}
