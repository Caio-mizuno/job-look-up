import * as cheerio from "cheerio";
import { requireBrowser } from "./browser";
import { SOURCE_LABELS } from "./labels";
import { normalizeText } from "./match";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.glassdoor.com.br";

const slug = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Busca no Brasil inteiro: `KO` marca onde está a palavra-chave dentro do caminho. */
function searchUrl(keywords: string): string {
  const kw = slug(keywords);
  const prefix = "brasil-";
  return `${BASE}/Vaga/${prefix}${kw}-vagas-SRCH_IL.0,6_IN36_KO${prefix.length},${prefix.length + kw.length}.htm`;
}

/** "24h" / "2 dia(s)" / "mais de 30 dias" → data aproximada. */
function parseAge(text: string, now = Date.now()): Date | null {
  const t = normalizeText(text);
  if (t.includes("hoje")) return new Date(now);
  const hours = /(\d+)\s*h\b/.exec(t);
  if (hours) return new Date(now - Number(hours[1]) * 3_600_000);
  const days = /(\d+)\s*d/.exec(t);
  return days ? new Date(now - Number(days[1]) * 86_400_000) : null;
}

/**
 * O Glassdoor barra requisições simples (Cloudflare): a busca abre no Chrome da pessoa pelo ajudante.
 * Sem detalhe: a página da vaga pede verificação anti-robô, então fica o resumo do card.
 */
export const glassdoorSource: JobSource = {
  id: "glassdoor",
  label: SOURCE_LABELS.glassdoor,
  homepage: BASE,
  defaultEnabled: false,
  maxPages: 1,
  async search(q, _page, _http, ctx) {
    const html = await requireBrowser(ctx).getHtml(searchUrl(q.keywords), { waitFor: '[data-test="jobListing"]' });
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];
    $('[data-test="jobListing"]').each((_, el) => {
      const card = $(el);
      const a = card.find('a[data-test="job-title"]').first();
      const href = a.attr("href");
      const title = a.text().replace(/\s+/g, " ").trim();
      if (!href || !title) return;
      const location = card.find('[data-test="emp-location"]').text().replace(/\s+/g, " ").trim() || null;
      const salary = card.find('[data-test="detailSalary"]').text().replace(/\s+/g, " ").trim();
      const snippet = card.find('[data-test="descSnippet"]').html();
      jobs.push({
        source: "glassdoor",
        sourceJobId: card.attr("data-jobid") ?? null,
        url: new URL(href, BASE).toString(),
        title,
        company: card.find('[class*="EmployerProfile_compactEmployerName"]').first().text().trim() || null,
        location,
        workModelHint: location,
        contractHint: null,
        // Só o salário informado pela empresa; a estimativa do Glassdoor não é oferta.
        salaryText: /fornecido pela empresa/i.test(salary) ? salary.replace(/\s*\(.*\)\s*$/, "") : null,
        postedAt: parseAge(card.find('[data-test="job-age"]').text()),
        descriptionText: snippet ? htmlToText(snippet).replace(/…?&hellip;/g, "…") || null : null,
      });
    });
    return jobs;
  },
};
