import { getDb } from "@/server/db/client";
import { verifyBridgeAuth } from "@/server/bridge/auth";
import { onClaim } from "@/server/bridge/lifecycle";
import { touchBridge } from "@/server/bridge/presence";
import { claimNext, type TaskType } from "@/server/tasks/queue";

const BRIDGE_TYPES = new Set<TaskType>(["llm_call", "apply", "browser_fetch"]);

export async function GET(req: Request): Promise<Response> {
  if (!verifyBridgeAuth(req)) return new Response(null, { status: 401 });
  const db = getDb();
  const now = Date.now();
  // Todo poll conta como sinal de vida, mesmo quando o ajudante está ocupado.
  touchBridge(db, now);

  const accept = (new URL(req.url).searchParams.get("accept") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TaskType => BRIDGE_TYPES.has(s as TaskType));
  if (accept.length === 0) return new Response(null, { status: 204 });

  const task = claimNext(db, { runner: "bridge", types: accept, now });
  if (!task) return new Response(null, { status: 204 });
  onClaim(db, task);
  return Response.json({ id: task.id, type: task.type, payload: task.payload });
}
