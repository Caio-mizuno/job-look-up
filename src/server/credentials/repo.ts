import { asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { safeHttpUrl } from "@/lib/safe-url";
import { decrypt, encrypt } from "@/server/crypto";
import type { Db } from "@/server/db/client";
import { credentials } from "@/server/db/schema";
import { getEnv } from "@/server/env";

/** O que a tela recebe: tudo menos a senha. */
export type CredentialSummary = {
  id: number;
  site: string;
  url: string | null;
  username: string;
  notes: string | null;
  updatedAt: number;
};

export const CredentialInputSchema = z
  .object({
    id: z.number().int().positive().optional(),
    site: z.string().trim().min(1, "Informe o site.").max(80, "Nome do site muito longo."),
    url: z
      .string()
      .trim()
      .max(500, "Endereço muito longo.")
      .refine((v) => v === "" || safeHttpUrl(v) !== null, "O endereço precisa começar com http:// ou https://."),
    username: z.string().trim().min(1, "Informe o login.").max(200, "Login muito longo."),
    // Sem trim: espaço pode fazer parte da senha. Vazia na edição mantém a atual.
    password: z.string().max(500, "Senha muito longa."),
    notes: z.string().trim().max(1000, "Observação muito longa."),
  })
  .refine((v) => v.id !== undefined || v.password.length > 0, { message: "Informe a senha.", path: ["password"] });

export type CredentialInput = z.input<typeof CredentialInputSchema>;

/** A APP_KEY mudou desde que a senha foi salva: não há como abrir. */
export class CredentialUnreadableError extends Error {
  constructor() {
    super("Não consegui abrir a senha: a APP_KEY do .env mudou desde que ela foi salva. Salve a senha de novo.");
  }
}

/** "https://www.gupy.io/login" → "gupy.io". */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

const SECOND_LEVEL = new Set(["com", "net", "org", "gov", "edu", "co"]);

/** Domínio registrado: "empresa.gupy.io" → "gupy.io"; "www.catho.com.br" → "catho.com.br". */
export function baseDomain(host: string): string {
  const labels = host.split(".");
  const tld = labels.at(-1) ?? "";
  const keep = labels.length > 2 && tld.length === 2 && SECOND_LEVEL.has(labels.at(-2) ?? "") ? 3 : 2;
  return labels.slice(-keep).join(".");
}

const summary = {
  id: credentials.id,
  site: credentials.site,
  url: credentials.url,
  username: credentials.username,
  notes: credentials.notes,
  updatedAt: credentials.updatedAt,
};

export function listCredentials(db: Db): CredentialSummary[] {
  return db.select(summary).from(credentials).orderBy(asc(credentials.site), asc(credentials.id)).all();
}

/** Cria ou atualiza; devolve o id. Na edição, senha vazia mantém a que já estava salva. */
export function saveCredential(db: Db, input: CredentialInput, now: number): number {
  const v = CredentialInputSchema.parse(input);
  const url = v.url ? safeHttpUrl(v.url) : null;
  const values = {
    site: v.site,
    url,
    host: url ? hostOf(url) : null,
    username: v.username,
    notes: v.notes || null,
    updatedAt: now,
  };
  const password = v.password ? encrypt(v.password, getEnv().APP_KEY) : null;
  if (v.id !== undefined) {
    const res = db
      .update(credentials)
      .set(password ? { ...values, password } : values)
      .where(eq(credentials.id, v.id))
      .run();
    if (res.changes === 0) throw new Error("Credencial não encontrada.");
    return v.id;
  }
  const row = db
    .insert(credentials)
    .values({ ...values, password: password!, createdAt: now })
    .returning({ id: credentials.id })
    .get();
  return row.id;
}

export function deleteCredential(db: Db, id: number): void {
  db.delete(credentials).where(eq(credentials.id, id)).run();
}

/** Só para a pessoa, num clique explícito em "Mostrar" ou "Copiar". */
export function revealPassword(db: Db, id: number): string | null {
  const row = db.select({ password: credentials.password }).from(credentials).where(eq(credentials.id, id)).get();
  if (!row) return null;
  try {
    return decrypt(row.password, getEnv().APP_KEY);
  } catch {
    throw new CredentialUnreadableError();
  }
}

/** Login salvo para o link de uma vaga: mesmo endereço primeiro, depois mesmo domínio ("empresa.gupy.io" usa o de "gupy.io"). */
export function findCredentialForUrl(db: Db, url: string): CredentialSummary | null {
  const host = hostOf(url);
  if (!host) return null;
  const base = baseDomain(host);
  const rows = db
    .select({ ...summary, host: credentials.host })
    .from(credentials)
    .where(isNotNull(credentials.host))
    .all();
  const rank = (h: string) => (h === host ? 2 : baseDomain(h) === base ? 1 : 0);
  const best = rows
    .filter((r) => rank(r.host!) > 0)
    .sort((a, b) => rank(b.host!) - rank(a.host!) || b.updatedAt - a.updatedAt)[0];
  return best ? { id: best.id, site: best.site, url: best.url, username: best.username, notes: best.notes, updatedAt: best.updatedAt } : null;
}
