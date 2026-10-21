import { z } from "zod";
import type { Db } from "@/server/db/client";
import type { Task } from "@/server/tasks/queue";

export const BridgeResultBody = z.union([
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string().max(4000) }),
]);
export type BridgeResultBody = z.infer<typeof BridgeResultBody>;

/** Ganchos por tipo de tarefa quando o ajudante pega ou devolve uma tarefa. */
export function onClaim(_db: Db, _task: Task): void {}

export function onResult(_db: Db, _task: Task, _body: BridgeResultBody): void {}
