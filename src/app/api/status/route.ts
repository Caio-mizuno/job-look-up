import { getDb } from "@/server/db/client";
import { getStatus } from "@/server/status";

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(getStatus(getDb(), Date.now()));
}
