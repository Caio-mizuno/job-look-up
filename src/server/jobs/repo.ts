import type { Db } from "@/server/db/client";
import type { NewJob } from "@/server/pipeline/normalize";

/** Insere ou junta com a vaga já vista (mesma dedupeKey): completa campos vazios e prefere a descrição mais longa. */
export function upsertJob(db: Db, job: NewJob, now: number): { id: number; inserted: boolean } {
  const existing = db.$client.prepare("select id from jobs where dedupe_key = ?").get(job.dedupeKey) as
    | { id: number }
    | undefined;
  if (existing) {
    db.$client
      .prepare(
        `update jobs set
           last_seen_at = ?,
           company = coalesce(company, ?),
           location = coalesce(location, ?),
           work_model = coalesce(work_model, ?),
           contract = coalesce(contract, ?),
           seniority = coalesce(seniority, ?),
           salary_text = coalesce(salary_text, ?),
           posted_at = coalesce(posted_at, ?),
           contact_email = coalesce(contact_email, ?),
           description_text = case when length(coalesce(description_text, '')) < length(coalesce(?, ''))
                                   then ? else description_text end
         where id = ?`,
      )
      .run(
        now,
        job.company,
        job.location,
        job.workModel,
        job.contract,
        job.seniority,
        job.salaryText,
        job.postedAt,
        job.contactEmail,
        job.descriptionText,
        job.descriptionText,
        existing.id,
      );
    return { id: existing.id, inserted: false };
  }
  const res = db.$client
    .prepare(
      `insert into jobs (source, source_job_id, url, dedupe_key, title, company, location, work_model, contract, seniority,
                         salary_text, posted_at, description_text, contact_email, first_seen_at, last_seen_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      job.source,
      job.sourceJobId,
      job.url,
      job.dedupeKey,
      job.title,
      job.company,
      job.location,
      job.workModel,
      job.contract,
      job.seniority,
      job.salaryText,
      job.postedAt,
      job.descriptionText,
      job.contactEmail,
      now,
      now,
    );
  return { id: Number(res.lastInsertRowid), inserted: true };
}

export function setJobDescription(db: Db, id: number, text: string): void {
  db.$client.prepare("update jobs set description_text = ? where id = ?").run(text, id);
}
