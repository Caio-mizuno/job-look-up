import * as cheerio from "cheerio";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

type GupyJob = {
  id: number;
  name: string;
  careerPageName?: string;
  type?: string;
  publishedDate?: string;
  workplaceType?: string;
  city?: string;
  state?: string;
  jobUrl: string;
  description?: string;
};

const CONTRACT: Record<string, string> = {
  vacancy_type_effective: "CLT",
  vacancy_legal_entity: "PJ",
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/** O portal da Gupy é Next.js: a primeira página de resultados vem pronta no __NEXT_DATA__. */
export const gupySource: JobSource = {
  id: "gupy",
  label: "Gupy",
  homepage: "https://portal.gupy.io",
  defaultEnabled: true,
  maxPages: 1,
  userAgent: BROWSER_UA,
  async search(q, _page, http) {
    const html = await http.getText(`https://portal.gupy.io/job-search/term=${encodeURIComponent(q.keywords)}`, {
      userAgent: this.userAgent,
    });
    const raw = cheerio.load(html)("#__NEXT_DATA__").text();
    if (!raw) return [];
    let jobs: GupyJob[] = [];
    try {
      jobs = JSON.parse(raw)?.props?.pageProps?.initialJobList?.data ?? [];
    } catch {
      return [];
    }
    return jobs
      .filter((j) => j.jobUrl && j.name)
      .map(
        (j): RawJob => ({
          source: "gupy",
          sourceJobId: String(j.id),
          url: j.jobUrl,
          title: j.name.trim(),
          company: j.careerPageName?.trim() || null,
          location: [j.city, j.state].filter(Boolean).join(" - ") || null,
          workModelHint: j.workplaceType ?? null,
          contractHint: (j.type && CONTRACT[j.type]) ?? null,
          salaryText: null,
          postedAt: j.publishedDate ? new Date(j.publishedDate) : null,
          descriptionText: j.description ? htmlToText(j.description) : null,
        }),
      );
  },
};
