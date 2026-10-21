import { SOURCE_LABELS } from "./labels";
import { matchesKeywords } from "./match";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

type WnJob = {
  url: string;
  title: string;
  description?: string;
  company_name?: string;
  category_name?: string;
  location?: string;
  pub_date?: string;
};

/** Feed público (um GET serve todas as consultas, cache de 6 h); só a categoria Development. */
export const workingnomadsSource: JobSource = {
  id: "workingnomads",
  label: SOURCE_LABELS.workingnomads,
  homepage: "https://www.workingnomads.com",
  defaultEnabled: true,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const feed = await http.getJson<WnJob[]>("https://www.workingnomads.com/api/exposed_jobs/", { cacheTtlMs: this.cacheTtlMs });
    return feed
      .filter((j) => j.category_name === "Development" && j.url && j.title && matchesKeywords(j.title, q.keywords))
      .map(
        (j): RawJob => ({
          source: "workingnomads",
          sourceJobId: j.url,
          url: j.url,
          title: j.title.trim(),
          company: j.company_name?.trim() || null,
          location: j.location?.trim() || null,
          workModelHint: "remote",
          contractHint: null,
          salaryText: null,
          postedAt: j.pub_date ? new Date(j.pub_date) : null,
          descriptionText: j.description ? htmlToText(j.description) : null,
        }),
      );
  },
};
