import type { Db } from "@/server/db/client";
import type { ApplicationStatus } from "@/server/db/schema";
import { toApplication } from "./repo";
import type { ApplyEvent, ApplyReport, ExtraAnswer } from "./schema";

export type ApplicationListItem = {
  id: number;
  status: ApplicationStatus;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
  events: ApplyEvent[];
  extraAnswers: ExtraAnswer[];
  report: ApplyReport | null;
  job: { id: number; title: string; company: string | null; url: string; source: string };
};

export function listApplications(db: Db): ApplicationListItem[] {
  const rows = db.$client
    .prepare(
      `select a.*, j.title j_title, j.company j_company, j.url j_url, j.source j_source
       from applications a join jobs j on j.id = a.job_id
       where a.status != 'cancelled'
       order by a.created_at desc, a.id desc`,
    )
    .all() as (Parameters<typeof toApplication>[0] & { j_title: string; j_company: string | null; j_url: string; j_source: string })[];
  return rows.map((r) => {
    const app = toApplication(r);
    return {
      id: app.id,
      status: app.status,
      error: app.error,
      createdAt: app.createdAt,
      finishedAt: app.finishedAt,
      events: app.events.slice(-10),
      extraAnswers: app.extraAnswers,
      report: app.report,
      job: { id: app.jobId, title: r.j_title, company: r.j_company, url: r.j_url, source: r.j_source },
    };
  });
}

export function hasActiveApplications(db: Db): boolean {
  return Boolean(db.$client.prepare("select 1 from applications where status in ('queued','running') limit 1").get());
}
