"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { CredentialUnreadableError, deleteCredential, revealPassword, saveCredential } from "@/server/credentials/repo";
import type { CredentialInput } from "@/server/credentials/repo";
import { getDb } from "@/server/db/client";

export type SaveCredentialResult = { ok: true; id: number } | { ok: false; error: string };
export type RevealResult = { ok: true; password: string } | { ok: false; error: string };

export async function saveCredentialAction(input: CredentialInput): Promise<SaveCredentialResult> {
  try {
    const id = saveCredential(getDb(), input, Date.now());
    refresh();
    return { ok: true, id };
  } catch (err) {
    // Só a mensagem de validação volta para a tela; a senha nunca entra no erro.
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Dados inválidos." };
    return { ok: false, error: err instanceof Error ? err.message : "Não consegui salvar." };
  }
}

export async function deleteCredentialAction(id: number): Promise<void> {
  deleteCredential(getDb(), id);
  refresh();
}

/** Única saída da senha: clique da pessoa em "Mostrar" ou "Copiar". */
export async function revealPasswordAction(id: number): Promise<RevealResult> {
  try {
    const password = revealPassword(getDb(), id);
    return password === null ? { ok: false, error: "Credencial não encontrada." } : { ok: true, password };
  } catch (err) {
    return { ok: false, error: err instanceof CredentialUnreadableError ? err.message : "Não consegui abrir a senha." };
  }
}
