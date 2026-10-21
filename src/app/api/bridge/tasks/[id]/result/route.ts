import { getDb } from "@/server/db/client";
import { verifyBridgeAuth } from "@/server/bridge/auth";
import { BridgeResultBody, onResult } from "@/server/bridge/lifecycle";
import { completeTask, failTask, getTask } from "@/server/tasks/queue";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!verifyBridgeAuth(req)) return new Response(null, { status: 401 });
  const id = Number((await ctx.params).id);
  const db = getDb();
  const task = Number.isInteger(id) ? getTask(db, id) : null;
  if (!task || task.runner !== "bridge" || task.status !== "running") return new Response(null, { status: 404 });

  const parsed = BridgeResultBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "corpo inválido" }, { status: 400 });

  if (parsed.data.ok) completeTask(db, id, parsed.data.result);
  else failTask(db, id, parsed.data.error);
  onResult(db, task, parsed.data);
  return new Response(null, { status: 204 });
}
