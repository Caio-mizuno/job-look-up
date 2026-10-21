"use client";

import { useState } from "react";
import { toast } from "sonner";
import { loadProfile, startImport } from "@/app/onboarding/actions";
import type { Profile } from "@/server/profile/schema";
import { waitTask } from "@/lib/wait-task";

export const IMPORT_ERRORS = {
  unsupported: "Formato não suportado. Use PDF, .md ou .txt.",
  too_large: "Arquivo maior que 5 MB.",
  no_text: "Não encontrei texto. Se o PDF é escaneado (imagem), cole o texto em vez de enviar o arquivo.",
} as const;

export type ImportOutcome = { ok: true; profile: Profile } | { ok: false; error: string };

/**
 * Envia texto/arquivo para a IA extrair o perfil e recarrega o perfil quando termina.
 * `notify: false` quando a tela mostra o resultado por conta própria.
 */
export function useProfileImport(onProfile: (p: Profile) => void, { notify = true } = {}) {
  const [importing, setImporting] = useState(false);

  const fail = (error: string): ImportOutcome => {
    if (notify) toast.error(error);
    return { ok: false, error };
  };

  const run = async (form: FormData): Promise<ImportOutcome> => {
    setImporting(true);
    try {
      const res = await startImport(form);
      if ("error" in res) return fail(IMPORT_ERRORS[res.error]);
      const task = await waitTask(res.taskId, { timeoutMs: 240_000, intervalMs: 1500 });
      const deferred = (task.result as { deferred?: boolean } | null)?.deferred;
      if (task.status !== "done" || deferred) {
        return fail(deferred ? "Ajudante desligado: rode make bridge e tente de novo." : `A IA falhou: ${task.error}`);
      }
      const profile = await loadProfile();
      onProfile(profile);
      if (notify) toast.success("Perfil preenchido. Revise os dados.");
      return { ok: true, profile };
    } finally {
      setImporting(false);
    }
  };

  return { importing, run };
}
