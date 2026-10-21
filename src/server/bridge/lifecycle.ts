import { z } from "zod";
import { applyReport, failApplication, getApplicationByTask } from "@/server/applications/repo";
import { ApplyReportSchema } from "@/server/applications/schema";
import type { Db } from "@/server/db/client";
import type { Task } from "@/server/tasks/queue";

export const BridgeResultBody = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string().max(4000) }),
]);
export type BridgeResultBody = z.infer<typeof BridgeResultBody>;

/** Ganchos por tipo de tarefa quando o ajudante pega ou devolve uma tarefa. */
export function onClaim(db: Db, task: Task): void {
  if (task.type !== "apply") return;
  db.$client
    .prepare("update applications set status = 'running', started_at = ? where task_id = ? and status != 'cancelled'")
    .run(Date.now(), task.id);
}

export function onResult(db: Db, task: Task, body: BridgeResultBody): void {
  if (task.type === "browser_fetch" && !body.ok) {
    // Página que falhou não repete sozinha: a fonte registra o erro e tenta na próxima busca.
    db.$client.prepare("update tasks set status = 'failed', error = ? where id = ?").run(body.error, task.id);
    return;
  }
  if (task.type !== "apply") return;
  // O CV só serve para o ajudante; não fica guardado no histórico de tarefas.
  db.$client.prepare("update tasks set payload = json_remove(payload, '$.cv') where id = ?").run(task.id);
  const app = getApplicationByTask(db, task.id);
  if (!app) return;
  const now = Date.now();
  if (!body.ok) {
    // Candidatura não repete sozinha (abriria outra aba no Chrome): falha e a pessoa decide.
    db.$client.prepare("update tasks set status = 'failed', error = ? where id = ?").run(body.error, task.id);
    failApplication(db, app.id, body.error, now);
    return;
  }
  const parsed = z.object({ report: ApplyReportSchema }).safeParse(body.result);
  if (!parsed.success) {
    failApplication(db, app.id, "relatório do ajudante em formato inválido", now);
    return;
  }
  applyReport(db, app.id, parsed.data.report, now);
}
