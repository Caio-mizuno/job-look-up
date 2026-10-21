import { requireBrowser } from "./browser";
import { readEmbeddedJson } from "./embedded-json";
import { SOURCE_LABELS } from "./labels";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://br.indeed.com";
const JOB_CARDS = 'window.mosaic.providerData["mosaic-provider-jobcards"]=';

type IndeedJob = {
  jobkey?: string;
  title?: string;
  displayTitle?: string;
  company?: string;
  formattedLocation?: string;
  remoteLocation?: boolean;
  snippet?: string;
  salarySnippet?: { text?: string };
  pubDate?: number;
  jobTypes?: string[];
  taxonomyAttributes?: { label: string; attributes: { label: string }[] }[];
};

type JobCardsData = { metaData?: { mosaicProviderJobCardsModel?: { results?: IndeedJob[] } } };

const attributes = (j: IndeedJob, label: string) =>
  j.taxonomyAttributes?.find((t) => t.label === label)?.attributes.map((a) => a.label) ?? [];

/**
 * O Indeed barra requisições simples (Cloudflare): a busca abre no Chrome da pessoa pelo ajudante.
 * Os cards vêm num JSON embutido na página de resultados.
 */
export const indeedSource: JobSource = {
  id: "indeed",
  label: SOURCE_LABELS.indeed,
  homepage: BASE,
  defaultEnabled: false,
  maxPages: 1,
  async search(q, page, _http, ctx) {
    const params = new URLSearchParams({ q: q.keywords });
    if (q.location) params.set("l", q.location);
    if (page > 1) params.set("start", String((page - 1) * 10));
    const html = await requireBrowser(ctx).getHtml(`${BASE}/jobs?${params.toString()}`, { waitFor: "[data-jk]" });
    const at = html.indexOf(JOB_CARDS);
    if (at < 0) return [];
    const data = readEmbeddedJson(html, at + JOB_CARDS.length) as JobCardsData | null;
    const results = data?.metaData?.mosaicProviderJobCardsModel?.results ?? [];
    return results.flatMap((j): RawJob[] => {
      const title = (j.displayTitle || j.title)?.trim();
      if (!j.jobkey || !title) return [];
      return [
        {
          source: "indeed",
          sourceJobId: j.jobkey,
          url: `${BASE}/viewjob?jk=${j.jobkey}`,
          title,
          company: j.company?.trim() || null,
          location: j.formattedLocation?.trim() || null,
          workModelHint: attributes(j, "remote").join(", ") || (j.remoteLocation ? "remote" : null),
          contractHint: [...new Set([...(j.jobTypes ?? []), ...attributes(j, "job-types")])].join(", ") || null,
          salaryText: j.salarySnippet?.text?.trim() || null,
          postedAt: j.pubDate ? new Date(j.pubDate) : null,
          descriptionText: j.snippet ? htmlToText(j.snippet) : null,
        },
      ];
    });
  },
  async fetchDetail(url, _http, ctx) {
    const jk = /[?&]jk=([0-9a-f]+)/.exec(url)?.[1];
    if (!jk) return null;
    const html = await requireBrowser(ctx).getHtml(`${BASE}/viewjob?jk=${jk}`, {
      waitFor: '[data-testid="vj-job-description-heading"]',
    });
    // A descrição vem como string JSON (HTML escapado) no estado inicial da página.
    const literal = /"sanitizedJobDescription":("(?:[^"\\]|\\.)*")/.exec(html)?.[1];
    if (!literal) return null;
    try {
      return htmlToText(JSON.parse(literal) as string) || null;
    } catch {
      return null;
    }
  },
};
