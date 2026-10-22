import { isAutoApplyAllowed } from "@/lib/apply-url";
import type { JobListItem } from "@/server/jobs/list";

/** Teto do "Quero participar" em lote: o ajudante faz uma candidatura por vez, no Chrome da pessoa. */
export const BULK_APPLY_MAX = 50;

export type BulkSkipReason = "not_found" | "linkedin" | "active" | "limit";

/** Entra no lote só o que o botão individual também enfileiraria de novo (sem candidatura viva). */
export function canBulkApply(job: Pick<JobListItem, "url" | "status" | "application">): boolean {
  if (!isAutoApplyAllowed(job.url) || job.status === "applied") return false;
  return !job.application || job.application.status === "failed" || job.application.status === "login_required";
}
