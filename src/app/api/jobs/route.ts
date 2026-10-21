import { z } from "zod";
import { getDb } from "@/server/db/client";
import { ContractEnum, SeniorityEnum, WorkModelEnum } from "@/server/domain/enums";
import { listJobs } from "@/server/jobs/list";
import { getProfile } from "@/server/profile/repo";

export const dynamic = "force-dynamic";

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((s) => (typeof s === "string" && s ? s.split(",").filter(Boolean) : []), z.array(item));

const Query = z.object({
  sort: z.enum(["match", "recent"]).default("match"),
  workModels: csv(WorkModelEnum),
  contracts: csv(ContractEnum),
  seniorities: csv(SeniorityEnum),
  lastDays: z.coerce.number().int().min(1).max(365).optional(),
  unseenOnly: z.enum(["1", "true"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  lastVisitAt: z.coerce.number().int().min(0).default(0),
});

export function GET(req: Request): Response {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "parâmetros inválidos" }, { status: 400 });
  const q = parsed.data;
  const db = getDb();
  return Response.json(
    listJobs(
      db,
      { ...q, unseenOnly: q.unseenOnly !== undefined },
      { profileVersion: getProfile(db)?.version ?? null, lastVisitAt: q.lastVisitAt },
    ),
  );
}
