import { isAutoApplyAllowed } from "@/lib/apply-url";
import type { JobListItem } from "@/server/jobs/list";

/** Teto do "Quero participar" em lote: o ajudante faz uma candidatura por vez, no Chrome da pessoa. */
export const BULK_APPLY_MAX = 50;

export type BulkSkipReason = "not_found" | "linkedin" | "active" | "limit";

/**
 * Entra no lote só vaga sem candidatura viva. "Falhou" fica de fora: a falha pode ter vindo depois do clique em
 * Enviar (tempo esgotado, limite do plano), então repetir é decisão individual, no "Tentar de novo".
 */
export function canBulkApply(job: Pick<JobListItem, "url" | "status" | "application">): boolean {
  if (!isAutoApplyAllowed(job.url) || job.status === "applied") return false;
  return !job.application || job.application.status === "login_required";
}
