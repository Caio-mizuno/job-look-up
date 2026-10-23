import { SOURCE_LABELS } from "./labels";
import { keywordMatcher } from "./match";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.netvagas.com.br";
const SITEMAP_INDEX = `${BASE}/sitemap-netvagas.xml`;
// Os sitemaps de vagas seguem o id crescente: os dois últimos têm as vagas mais novas.
const NEWEST_SITEMAPS = 2;
const MAX_AGE_MS = 30 * 86_400_000;
const MAX_RESULTS = 40;

type Entry = { id: string; slug: string; url: string; lastmod: Date | null };

function parseUrlset(xml: string): Entry[] {
  const entries: Entry[] = [];
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const url = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(block)?.[1];
    const hit = url && /^https:\/\/www\.netvagas\.com\.br\/empresa\/anuncios\/a(\d+)\/([^/]+)\/$/.exec(url);
    if (!hit) continue;
    const lastmod = new Date(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(block)?.[1] ?? NaN);
    entries.push({ id: hit[1], slug: hit[2], url, lastmod: Number.isNaN(lastmod.getTime()) ? null : lastmod });
  }
  return entries;
}

/** "consultor-a-comercial-pl" → "Consultor(a) comercial PL": o sitemap só traz o endereço da vaga. */
export function titleFromSlug(slug: string): string {
  const title = slug
    .replace(/^\d{4,}-/, "")
    .replace(/-copia(-\d+)?$/, "")
    .replace(/(or|ico|eiro|ado)-a(?=-|$)/g, "$1(a)")
    .split("-")
    .filter(Boolean)
    .map((w) => (/^([b-df-hj-np-tv-z]{2,4}|ii|iii|iv)$/.test(w) ? w.toUpperCase() : w))
    .join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/**
 * O Netvagas monta a página por JavaScript cifrado e recusa navegador automatizado; o sitemap de vagas
 * (liberado no robots.txt) é a porta aberta. Vem só título (do endereço), link e data: sem empresa nem descrição.
 */
export const netvagasSource: JobSource = {
  id: "netvagas",
  label: SOURCE_LABELS.netvagas,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const index = await http.getText(SITEMAP_INDEX, { cacheTtlMs: this.cacheTtlMs });
    const sitemaps = [...index.matchAll(/<loc>\s*(https:\/\/www\.netvagas\.com\.br\/sitemap-netvagas-vagas-(\d+)\.xml)\s*<\/loc>/g)]
      .sort((a, b) => Number(b[2]) - Number(a[2]))
      .slice(0, NEWEST_SITEMAPS)
      .map((m) => m[1]);
    const xmls = await Promise.all(sitemaps.map((url) => http.getText(url, { cacheTtlMs: this.cacheTtlMs })));
    const hits = keywordMatcher(q.keywords);
    const since = Date.now() - MAX_AGE_MS;
    return xmls
      .flatMap(parseUrlset)
      .filter((e) => !e.lastmod || e.lastmod.getTime() >= since)
      .map((e) => ({ e, hits: hits(e.slug.replace(/-/g, " ")) }))
      .filter((m) => m.hits > 0)
      // Mais palavras casadas primeiro; no empate, a vaga mais nova.
      .sort((a, b) => b.hits - a.hits || Number(b.e.id) - Number(a.e.id))
      .slice(0, MAX_RESULTS)
      .map(
        ({ e }): RawJob => ({
          source: "netvagas",
          sourceJobId: e.id,
          url: e.url,
          title: titleFromSlug(e.slug),
          company: null,
          location: null,
          workModelHint: null,
          contractHint: null,
          salaryText: null,
          postedAt: e.lastmod,
          descriptionText: null,
        }),
      );
  },
};
