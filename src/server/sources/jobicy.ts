import { SOURCE_LABELS } from "./labels";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

type JobicyJob = {
  id: number | string;
  url: string;
  jobTitle: string;
  companyName?: string;
  jobGeo?: string;
  jobLevel?: string;
  jobType?: string[] | string;
  pubDate?: string;
  salaryMin?: number | string;
  salaryMax?: number | string;
  salaryCurrency?: string;
  salaryPeriod?: string;
  jobDescription?: string;
};

/** API pública da Jobicy: exige crédito com link e candidatura pela URL original (o card faz as duas coisas). */
export const jobicySource: JobSource = {
  id: "jobicy",
  label: SOURCE_LABELS.jobicy,
  homepage: "https://jobicy.com",
  defaultEnabled: true,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const data = await http.getJson<{ jobs?: JobicyJob[] }>(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(q.keywords)}`,
      { cacheTtlMs: this.cacheTtlMs },
    );
    return (data.jobs ?? [])
      .filter((j) => j.url && j.jobTitle)
      .map(
        (j): RawJob => ({
          source: "jobicy",
          sourceJobId: String(j.id),
          url: j.url,
          title: j.jobTitle.trim(),
          company: j.companyName?.trim() || null,
          location: j.jobGeo?.trim() || null,
          workModelHint: "remote",
          contractHint: Array.isArray(j.jobType) ? j.jobType.join(", ") : (j.jobType ?? null),
          salaryText: formatSalaryRange(j.salaryMin, j.salaryMax, j.salaryCurrency ?? "USD", j.salaryPeriod ?? "yearly"),
          postedAt: j.pubDate ? new Date(j.pubDate) : null,
          descriptionText: [j.jobLevel && `Senioridade: ${j.jobLevel}.`, j.jobDescription && htmlToText(j.jobDescription)]
            .filter(Boolean)
            .join("\n") || null,
        }),
      );
  },
};
