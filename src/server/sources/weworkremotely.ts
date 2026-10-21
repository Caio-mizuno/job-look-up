import * as cheerio from "cheerio";
import { SOURCE_LABELS } from "./labels";
import { matchesKeywords } from "./match";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

/** RSS público de vagas de programação; o título vem como "Empresa: Cargo". Cache de 6 h. */
export const weworkremotelySource: JobSource = {
  id: "weworkremotely",
  label: SOURCE_LABELS.weworkremotely,
  homepage: "https://weworkremotely.com",
  defaultEnabled: true,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const xml = await http.getText("https://weworkremotely.com/categories/remote-programming-jobs.rss", {
      cacheTtlMs: this.cacheTtlMs,
    });
    const $ = cheerio.load(xml, { xml: true });
    const jobs: RawJob[] = [];
    $("item").each((_, el) => {
      const item = $(el);
      const full = item.find("title").first().text().trim();
      const link = item.find("link").first().text().trim();
      const sep = full.indexOf(": ");
      const company = sep > 0 ? full.slice(0, sep).trim() : null;
      const title = sep > 0 ? full.slice(sep + 2).trim() : full;
      if (!title || !link || !matchesKeywords(title, q.keywords)) return;
      const pub = item.find("pubDate").first().text().trim();
      jobs.push({
        source: "weworkremotely",
        sourceJobId: item.find("guid").first().text().trim() || null,
        url: link,
        title,
        company,
        location: item.find("region").first().text().trim() || null,
        workModelHint: "remote",
        contractHint: item.find("type").first().text().trim() || null,
        salaryText: null,
        postedAt: pub ? new Date(pub) : null,
        descriptionText: htmlToText(item.find("description").first().text()) || null,
      });
    });
    return jobs;
  },
};
