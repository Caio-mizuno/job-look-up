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

/** Envia texto/arquivo para a IA extrair o perfil e recarrega o perfil quando termina. */
export function useProfileImport(onProfile: (p: Profile) => void) {
  const [importing, setImporting] = useState(false);

  const run = async (form: FormData): Promise<boolean> => {
    setImporting(true);
    try {
      const res = await startImport(form);
      if ("error" in res) {
        toast.error(IMPORT_ERRORS[res.error]);
        return false;
      }
      const task = await waitTask(res.taskId, { timeoutMs: 240_000, intervalMs: 1500 });
      const deferred = (task.result as { deferred?: boolean } | null)?.deferred;
      if (task.status !== "done" || deferred) {
        toast.error(deferred ? "Ajudante desligado: rode make bridge e tente de novo." : `A IA falhou: ${task.error}`);
        return false;
      }
      onProfile(await loadProfile());
      toast.success("Perfil preenchido. Revise os dados.");
      return true;
    } finally {
      setImporting(false);
    }
  };

  return { importing, run };
}
