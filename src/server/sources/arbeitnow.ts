import { matchesKeywords } from "./match";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

type ArbeitnowJob = {
  slug: string;
  company_name?: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  location?: string;
  created_at?: number;
};

/** Foco em Europa e sem busca na API: filtro local por título; desligada por padrão. */
export const arbeitnowSource: JobSource = {
  id: "arbeitnow",
  label: "Arbeitnow",
  homepage: "https://www.arbeitnow.com",
  defaultEnabled: false,
  maxPages: 2,
  cacheTtlMs: 21_600_000,
  async search(q, page, http) {
    const data = await http.getJson<{ data?: ArbeitnowJob[] }>(
      `https://www.arbeitnow.com/api/job-board-api?page=${page}`,
      { cacheTtlMs: this.cacheTtlMs },
    );
    return (data.data ?? [])
      .filter((j) => j.title && j.url && matchesKeywords(j.title, q.keywords))
      .map(
        (j): RawJob => ({
          source: "arbeitnow",
          sourceJobId: j.slug,
          url: j.url,
          title: j.title.trim(),
          company: j.company_name?.trim() || null,
          location: j.location?.trim() || null,
          workModelHint: j.remote ? "remote" : (j.location ?? null),
          contractHint: null,
          salaryText: null,
          postedAt: j.created_at ? new Date(j.created_at * 1000) : null,
          descriptionText: j.description ? htmlToText(j.description) : null,
        }),
      );
  },
};
