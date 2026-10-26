import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "@/server/crypto";
import type { Db } from "@/server/db/client";
import { settings } from "@/server/db/schema";
import { getEnv } from "@/server/env";

export type LlmProviderId = "claude-code" | "anthropic" | "openai-compatible";
export type OpenAiCompatibleConfig = { baseUrl: string; model: string; apiKey: string };
/** Última importação de currículo que deu certo: a etapa mostra de onde o perfil veio. */
export type LastImport = { source: string; at: number };
/** Carta de apresentação genérica; fora do perfil para editar a carta não mudar a versão do perfil. */
export type CoverLetter = { text: string; updatedAt: number };

type Def<T> = { default: T; secret: boolean };
const def = <T>(value: T, secret = false): Def<T> => ({ default: value, secret });

export const SETTINGS = {
  "llm.provider": def<LlmProviderId>("claude-code"),
  "llm.anthropicApiKey": def<string | null>(null, true),
  "llm.openaiCompatible": def<OpenAiCompatibleConfig | null>(null, true),
  "llm.dailyCallCap": def<number>(0),
  "search.intervalHours": def<number>(6),
  "search.topK": def<number>(40),
  "search.lastVisitAt": def<number>(0),
  "bridge.lastSeenAt": def<number>(0),
  "bridge.privacyAcceptedAt": def<number | null>(null),
  "onboarding.completedSteps": def<number[]>([]),
  "onboarding.lastImport": def<LastImport | null>(null),
  "profile.coverLetter": def<CoverLetter | null>(null),
};

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = (typeof SETTINGS)[K]["default"];

export function getSetting<K extends SettingKey>(db: Db, key: K): SettingValue<K> {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return SETTINGS[key].default;
  const raw = SETTINGS[key].secret ? decrypt(row.value, getEnv().APP_KEY) : row.value;
  return JSON.parse(raw) as SettingValue<K>;
}

export function setSetting<K extends SettingKey>(db: Db, key: K, value: SettingValue<K>): void {
  const json = JSON.stringify(value);
  const stored = SETTINGS[key].secret ? encrypt(json, getEnv().APP_KEY) : json;
  const now = Date.now();
  db.insert(settings)
    .values({ key, value: stored, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: stored, updatedAt: now } })
    .run();
}
