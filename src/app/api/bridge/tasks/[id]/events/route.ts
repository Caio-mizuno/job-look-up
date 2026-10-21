import { z } from "zod";
import { appendEvents, getApplicationByTask } from "@/server/applications/repo";
import { ApplyEventSchema } from "@/server/applications/schema";
import { verifyBridgeAuth } from "@/server/bridge/auth";
import { getDb } from "@/server/db/client";
import { getTask } from "@/server/tasks/queue";

const Body = z.object({ events: z.array(ApplyEventSchema).max(200) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!verifyBridgeAuth(req)) return new Response(null, { status: 401 });
  const id = Number((await ctx.params).id);
  const db = getDb();
  const task = Number.isInteger(id) ? getTask(db, id) : null;
  if (!task || task.type !== "apply" || task.status !== "running") return new Response(null, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "corpo inválido" }, { status: 400 });
  const app = getApplicationByTask(db, id);
  if (app) appendEvents(db, app.id, parsed.data.events);
  return new Response(null, { status: 204 });
}
