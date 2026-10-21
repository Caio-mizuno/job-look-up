import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import { SOURCE_LABELS } from "./labels";
import type { JobSource, RawJob } from "./types";

type HimalayasJob = {
  title: string;
  companyName?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string | null;
  salaryPeriod?: string;
  locationRestrictions?: string[];
  description?: string;
  pubDate?: number | string;
  guid?: string;
  applicationLink?: string;
};

export const himalayasSource: JobSource = {
  id: "himalayas",
  label: SOURCE_LABELS.himalayas,
  homepage: "https://himalayas.app",
  defaultEnabled: true,
  maxPages: 1,
  async search(q, page, http) {
    const params = new URLSearchParams({ q: q.keywords, limit: "20", offset: String((page - 1) * 20) });
    const data = await http.getJson<{ jobs?: HimalayasJob[] }>(`https://himalayas.app/jobs/api/search?${params.toString()}`);
    return (data.jobs ?? [])
      .filter((j) => j.title && (j.guid || j.applicationLink))
      .map(
        (j): RawJob => ({
          source: "himalayas",
          sourceJobId: j.guid ?? null,
          url: j.guid ?? j.applicationLink!,
          title: j.title.trim(),
          company: j.companyName?.trim() || null,
          location: j.locationRestrictions?.length ? j.locationRestrictions.slice(0, 3).join(", ") : "Remoto (global)",
          workModelHint: "remote",
          contractHint: j.employmentType ?? null,
          salaryText: formatSalaryRange(j.minSalary, j.maxSalary, j.currency ?? "USD", j.salaryPeriod ?? "annual"),
          postedAt: j.pubDate ? new Date(Number(j.pubDate) * 1000) : null,
          descriptionText: j.description ? htmlToText(j.description) : null,
        }),
      );
  },
};
