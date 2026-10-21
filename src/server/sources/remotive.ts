import { htmlToText } from "./text";
import { SOURCE_LABELS } from "./labels";
import { matchesKeywords } from "./match";
import type { JobSource, RawJob } from "./types";

type RemotiveJob = {
  id: number | string;
  url: string;
  title: string;
  company_name?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

/**
 * Termos da Remotive: link de volta, crédito à fonte e no máximo ~4 consultas por dia.
 * Um único feed da categoria (cache de 6 h compartilhado entre rodadas) atende todas as consultas.
 */
export const remotiveSource: JobSource = {
  id: "remotive",
  label: SOURCE_LABELS.remotive,
  homepage: "https://remotive.com",
  defaultEnabled: true,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const data = await http.getJson<{ jobs?: RemotiveJob[] }>("https://remotive.com/api/remote-jobs?category=software-dev", {
      cacheTtlMs: this.cacheTtlMs,
    });
    return (data.jobs ?? []).filter((j) => j.title && matchesKeywords(j.title, q.keywords)).map(
      (j): RawJob => ({
        source: "remotive",
        sourceJobId: String(j.id),
        url: j.url,
        title: j.title.trim(),
        company: j.company_name?.trim() || null,
        location: j.candidate_required_location?.trim() || null,
        workModelHint: "remote",
        contractHint: j.job_type ?? null,
        salaryText: j.salary?.trim() || null,
        postedAt: j.publication_date ? new Date(`${j.publication_date}Z`) : null,
        descriptionText: j.description ? htmlToText(j.description) : null,
      }),
    );
  },
};
