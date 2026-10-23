import * as cheerio from "cheerio";
import { jobPostingText } from "./json-ld";
import { SOURCE_LABELS } from "./labels";
import { normalizeText } from "./match";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.catho.com.br";
const DAY = 86_400_000;

/** O site lê o trecho como texto ("-" vira espaço); "#" e "." contam ("c#", ".net"), "+" dá 404. */
const slug = (s: string) =>
  encodeURIComponent(
    normalizeText(s)
      .replace(/[^a-z0-9#.]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );

/** Cidade só com UF ("Curitiba - PR"): sem ela, "São Paulo" cai numa homônima e zera a busca. */
function citySegment(location: string | null): string {
  const m = location ? /^(.+?)\s*[-,/]\s*([a-z]{2})$/i.exec(location.trim()) : null;
  return m ? `${slug(`${m[1]} ${m[2]}`)}/` : "";
}

/** "Publicada em 20/10" (sem ano), "Atualizada Ontem", "Publicada Hoje". */
function parseDate(text: string, now = Date.now()): Date | null {
  const t = normalizeText(text);
  if (t.includes("hoje")) return new Date(now);
  if (t.includes("ontem")) return new Date(now - DAY);
  const m = /(\d{2})\/(\d{2})/.exec(t);
  if (!m) return null;
  const at = (year: number) => new Date(`${year}-${m[2]}-${m[1]}T12:00:00-03:00`);
  const year = new Date(now - 3 * 3_600_000).getUTCFullYear(); // ano em Brasília
  // Data no futuro é do ano anterior (virada de ano).
  return at(year).getTime() > now + DAY ? at(year - 1) : at(year);
}

/** Listagem renderizada no servidor (sem JSON embutido): cards em `li[data-offer-item]`; o texto vem do JSON-LD do detalhe. */
export const cathoSource: JobSource = {
  id: "catho",
  label: SOURCE_LABELS.catho,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, _page, http) {
    // `?q=` é proibido no robots.txt: a busca vai no caminho.
    const html = await http.getText(`${BASE}/vagas/${slug(q.keywords)}/${citySegment(q.location)}`);
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];
    $("li[data-offer-item]").each((_, el) => {
      const li = $(el);
      const a = li.find("h2.title_offer a").first();
      const href = a.attr("href");
      const title = a.text().replace(/\s+/g, " ").trim();
      if (!href || !title) return;
      const company = li.find("p.mb-2 > span").first().text().trim();
      // "<strong>36 vagas</strong> - Barueri <span>+ 35 cidades</span>": fica só a cidade.
      const location = li
        .find(".i_job_location")
        .parent()
        .clone()
        .children()
        .remove()
        .end()
        .text()
        .replace(/\s+/g, " ")
        .replace(/^\s*-\s*/, "")
        .trim();
      const salary = li.find(".i_salary").parent().find("strong").first().text().replace(/\s+/g, " ").trim();
      const date = li
        .find("span.tag")
        .filter((_, t) => /publicada|atualizada/i.test($(t).text()))
        .first()
        .text();
      jobs.push({
        source: "catho",
        sourceJobId: li.attr("data-offer-item") ?? null,
        url: `${BASE}${href}`,
        title,
        // "Empresa Confidencial" juntaria vagas diferentes na deduplicação.
        company: company && !/confidencial/i.test(company) ? company : null,
        location: location || null,
        // Vaga remota só aparece como prefixo do título ("Trabalhe de Casa - …").
        workModelHint: /trabalhe de casa/i.test(title) ? "remoto" : null,
        contractHint: null,
        salaryText: salary && !/a combinar/i.test(salary) ? salary : null,
        postedAt: parseDate(date),
        descriptionText: null,
      });
    });
    return jobs;
  },
  async fetchDetail(url, http) {
    if (!/^https:\/\/www\.catho\.com\.br\/vagas\/[^/?#]+\/\d+/.test(url)) return null;
    return jobPostingText(await http.getText(url));
  },
};
