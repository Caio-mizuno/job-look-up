import type { Db } from "@/server/db/client";
import type { ApplicationStatus, JobStatus } from "@/server/db/schema";
import type { Contract, Seniority, WorkModel } from "@/server/domain/enums";
import type { Enrichment } from "@/server/pipeline/enrich";
import { getSource } from "@/server/sources/registry";

const DAY = 86_400_000;

export type JobQuery = {
  workModels?: WorkModel[];
  contracts?: Contract[];
  seniorities?: Seniority[];
  lastDays?: number;
  unseenOnly?: boolean;
  sort: "match" | "recent";
  cursor?: string;
  limit?: number;
};

export type JobListItem = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  workModel: WorkModel | null;
  contract: Contract | null;
  seniority: Seniority | null;
  salaryText: string | null;
  postedAt: number | null;
  source: string;
  sourceLabel: string;
  sourceHomepage: string;
  url: string;
  status: JobStatus;
  isNew: boolean;
  /** pending = na fila de análise; none = fora do top-K, só analisa se a pessoa pedir. */
  analysis: "done" | "pending" | "failed" | "none";
  enrichment: (Omit<Enrichment, "jobId"> & { stale: boolean }) | null;
  application: { id: number; status: ApplicationStatus } | null;
  analysisError: string | null;
  /** Posts do LinkedIn: e-mail achado no texto e quando o "Enviar e-mail" deu certo. */
  contactEmail: string | null;
  emailSentAt: number | null;
};

type Row = {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  work_model: WorkModel | null;
  contract: Contract | null;
  seniority: Seniority | null;
  salary_text: string | null;
  posted_at: number | null;
  source: string;
  url: string;
  status: JobStatus;
  first_seen_at: number;
  analysis_error: string | null;
  contact_email: string | null;
  email_sent_at: number | null;
  e_score: number | null;
  e_data: string | null;
  e_version: string | null;
  queued: number;
  app_id: number | null;
  app_status: ApplicationStatus | null;
  k1: number;
  k2: number;
};

const encodeCursor = (k: [number, number, number]) => Buffer.from(JSON.stringify(k)).toString("base64url");
function decodeCursor(c: string): [number, number, number] | null {
  try {
    const v = JSON.parse(Buffer.from(c, "base64url").toString("utf8"));
    return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number") ? (v as [number, number, number]) : null;
  } catch {
    return null;
  }
}

export function listJobs(
  db: Db,
  q: JobQuery,
  ctx: { profileVersion: string | null; lastVisitAt: number; now?: number },
): { items: JobListItem[]; nextCursor: string | null } {
  const limit = Math.min(Math.max(q.limit ?? 20, 1), 100);
  // Chave de ordenação estável (k1, k2, id) também serve de cursor.
  const k1 = q.sort === "match" ? "coalesce(e.match_score, -1)" : "coalesce(j.posted_at, j.first_seen_at)";
  const k2 = q.sort === "match" ? "j.local_score" : "0";
  const where: string[] = ["j.status != 'discarded'"];
  const args: unknown[] = [ctx.profileVersion ?? ""];

  const inList = (col: string, values?: string[]) => {
    if (!values || values.length === 0) return;
    where.push(`${col} in (${values.map(() => "?").join(",")})`);
    args.push(...values);
  };
  inList("j.work_model", q.workModels);
  inList("j.contract", q.contracts);
  inList("j.seniority", q.seniorities);
  if (q.lastDays) {
    where.push("coalesce(j.posted_at, j.first_seen_at) >= ?");
    args.push((ctx.now ?? Date.now()) - q.lastDays * DAY);
  }
  if (q.unseenOnly) where.push("j.status = 'new'");
  const cursor = q.cursor ? decodeCursor(q.cursor) : null;
  if (cursor) {
    where.push(`((${k1}) < ? or ((${k1}) = ? and (${k2}) < ?) or ((${k1}) = ? and (${k2}) = ? and j.id < ?))`);
    args.push(cursor[0], cursor[0], cursor[1], cursor[0], cursor[1], cursor[2]);
  }

  const rows = db.$client
    .prepare(
      `select j.id, j.title, j.company, j.location, j.work_model, j.contract, j.seniority, j.salary_text, j.posted_at,
              j.source, j.url, j.status, j.first_seen_at, j.analysis_error, j.contact_email,
              (select max(o.created_at) from outreach_emails o where o.job_id = j.id and o.status = 'sent') email_sent_at,
              e.match_score e_score, e.data e_data, e.profile_version e_version,
              exists (
                select 1 from tasks t, json_each(t.payload, '$.jobIds') ids
                where t.type = 'enrich' and t.status in ('queued', 'running') and ids.value = j.id
              ) queued,
              a.id app_id, a.status app_status,
              ${k1} k1, ${k2} k2
       from jobs j
       left join job_enrichment e on e.rowid = (
         select e2.rowid from job_enrichment e2 where e2.job_id = j.id
         order by (e2.profile_version = ?) desc, e2.created_at desc limit 1
       )
       left join applications a on a.id = (
         select a2.id from applications a2 where a2.job_id = j.id and a2.status != 'cancelled'
         order by a2.created_at desc, a2.id desc limit 1
       )
       where ${where.join(" and ")}
       order by k1 desc, k2 desc, j.id desc
       limit ?`,
    )
    .all(...args, limit + 1) as Row[];

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => toItem(r, ctx)),
    nextCursor: rows.length > limit && last ? encodeCursor([last.k1, last.k2, last.id]) : null,
  };
}

function toItem(r: Row, ctx: { profileVersion: string | null; lastVisitAt: number }): JobListItem {
  const src = getSource(r.source);
  const data = r.e_data ? (JSON.parse(r.e_data) as Omit<Enrichment, "jobId" | "matchScore">) : null;
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location,
    workModel: r.work_model,
    contract: r.contract,
    seniority: r.seniority,
    salaryText: r.salary_text,
    postedAt: r.posted_at,
    source: r.source,
    sourceLabel: src?.label ?? r.source,
    sourceHomepage: src?.homepage ?? "",
    url: r.url,
    status: r.status,
    isNew: r.first_seen_at > ctx.lastVisitAt,
    analysis: r.analysis_error ? "failed" : data ? "done" : r.queued ? "pending" : "none",
    enrichment:
      data && r.e_score !== null
        ? { ...data, matchScore: r.e_score, stale: r.e_version !== ctx.profileVersion }
        : null,
    application: r.app_id !== null && r.app_status ? { id: r.app_id, status: r.app_status } : null,
    analysisError: r.analysis_error,
    contactEmail: r.contact_email,
    emailSentAt: r.email_sent_at,
  };
}

export function setJobStatus(db: Db, id: number, status: JobStatus, now: number): void {
  db.$client
    .prepare("update jobs set status = ?, seen_at = coalesce(seen_at, case when ? = 'seen' then ? end) where id = ?")
    .run(status, status, now, id);
}

/** "Cache" de descartadas: o status sobrevive a buscas novas porque o upsert nunca mexe nele. */
export function countDiscarded(db: Db): number {
  return (db.$client.prepare("select count(*) c from jobs where status = 'discarded'").get() as { c: number }).c;
}

/** Limpar o cache: as descartadas voltam para a lista e para a análise das próximas buscas. */
export function restoreDiscarded(db: Db): number {
  return db.$client.prepare("update jobs set status = 'seen' where status = 'discarded'").run().changes;
}

/** Registra a visita à lista e devolve a anterior (base do selo "Nova"). */
export function consumeLastVisit(db: Db, now: number = Date.now()): number {
  const previous = db.$client.prepare("select value from settings where key = 'search.lastVisitAt'").get() as
    | { value: string }
    | undefined;
  db.$client
    .prepare(
      `insert into settings (key, value, updated_at) values ('search.lastVisitAt', ?, ?)
       on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(JSON.stringify(now), now);
  return previous ? Number(JSON.parse(previous.value)) : 0;
}
