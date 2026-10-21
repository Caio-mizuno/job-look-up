import { getDb } from "@/server/db/client";
import { getTask, type TaskType } from "@/server/tasks/queue";

// Só tarefas que a UI acompanha; payloads de candidatura (dados pessoais, CV) ficam de fora.
const VISIBLE = new Set<TaskType>(["llm_test", "extract_profile", "draft_answers"]);

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = Number((await ctx.params).id);
  const task = Number.isInteger(id) ? getTask(getDb(), id) : null;
  if (!task || !VISIBLE.has(task.type)) return new Response(null, { status: 404 });
  return Response.json({ status: task.status, result: task.result, error: task.error });
}
