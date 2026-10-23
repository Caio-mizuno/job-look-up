import * as cheerio from "cheerio";
import { readJobPosting } from "./json-ld";
import { SOURCE_LABELS } from "./labels";
import { matchesKeywords } from "./match";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://coodesh.com";

/** "backend-java-senior-173839133" → "Backend java senior" (sem acento; o slug pode estar desatualizado). */
function titleFromSlug(slug: string): string {
  const t = slug.replace(/-\d+$/, "").replace(/-+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "2026-10-01" do sitemap: última atualização, que costuma ser a publicação. */
const parseLastmod = (s: string) => (!s ? null : new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00-03:00` : s));

/**
 * A busca do site chama api.coodesh.com, fechada a robôs no robots.txt. Usamos o sitemap público de vagas
 * (um GET para todas as consultas, cache de 6 h) filtrado pelo slug; o texto completo vem do JSON-LD da página.
 * Desligada por padrão: o slug pode estar desatualizado e a maioria das vagas é de uma empresa só.
 */
export const coodeshSource: JobSource = {
  id: "coodesh",
  label: SOURCE_LABELS.coodesh,
  homepage: BASE,
  defaultEnabled: false,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const xml = await http.getText(`${BASE}/sitemaps/jobs.xml`, { cacheTtlMs: this.cacheTtlMs });
    const $ = cheerio.load(xml, { xml: true });
    const jobs: RawJob[] = [];
    $("url").each((_, el) => {
      const url = $(el).children("loc").text().trim();
      const slug = /^https:\/\/coodesh\.com\/jobs\/([a-z0-9-]+)$/.exec(url)?.[1];
      if (!slug) return;
      const title = titleFromSlug(slug);
      if (!matchesKeywords(title, q.keywords)) return;
      jobs.push({
        source: "coodesh",
        sourceJobId: slug,
        url,
        title,
        company: null,
        location: null,
        workModelHint: null,
        contractHint: null,
        salaryText: null,
        postedAt: parseLastmod($(el).children("lastmod").text().trim()),
        descriptionText: null,
      });
    });
    return jobs;
  },
  async fetchDetail(url, http) {
    const job = readJobPosting(await http.getText(url));
    if (!job?.description) return null;
    const pay = job.baseSalary;
    const addr = job.jobLocation?.address;
    const place = [addr?.addressLocality, addr?.addressRegion].filter(Boolean).join(" - ");
    const salary = formatSalaryRange(
      pay?.value?.minValue,
      pay?.value?.maxValue,
      pay?.currency ?? "BRL",
      pay?.value?.unitText?.toLowerCase() ?? "",
    );
    // jobLocationType vem TELECOMMUTE até em vaga híbrida: não serve como modelo de trabalho.
    return [
      job.title && `Vaga: ${job.title}.`,
      job.hiringOrganization?.name && `Empresa: ${job.hiringOrganization.name}.`,
      salary && `Salário: ${salary}.`,
      place && `Local: ${place}.`,
      job.datePosted && `Publicada em: ${job.datePosted}.`,
      htmlToText(job.description),
    ]
      .filter(Boolean)
      .join("\n");
  },
};
