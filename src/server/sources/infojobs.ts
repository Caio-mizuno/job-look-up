import * as cheerio from "cheerio";
import { SOURCE_LABELS } from "./labels";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.infojobs.com.br";

export const infojobsSource: JobSource = {
  id: "infojobs",
  label: SOURCE_LABELS.infojobs,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, _page, http) {
    const html = await http.getText(`${BASE}/empregos.aspx?palabra=${encodeURIComponent(q.keywords)}`);
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];
    $(".js_vacancyLoad").each((_, el) => {
      const card = $(el);
      const href = card.attr("data-href");
      const title = card.find(".js_vacancyTitle").text().replace(/\s+/g, " ").trim();
      if (!href || !title) return;
      const byIcon = (icon: string) => card.find(`svg.${icon}`).first().parent().text().replace(/\s+/g, " ").trim() || null;
      const salary = byIcon("icon-money");
      const date = card.find(".js_date").attr("data-value"); // "2026/10/20 10:29:00", horário de Brasília
      const texts = card
        .find(".text-medium")
        .map((_, x) => $(x).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);
      jobs.push({
        source: "infojobs",
        sourceJobId: card.attr("data-id") ?? null,
        url: `${BASE}${href}`,
        title,
        company: card.find('a[href*="/empresa-"]').first().text().replace(/\s+/g, " ").trim() || null,
        // O site acrescenta a distância até o visitante ("…, 0 Km de você."): não é parte do local.
        location:
          card
            .find("div.mb-8")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .replace(/,?\s*[\d.,]+\s*km\b.*$/i, "")
            .trim() || null,
        workModelHint: byIcon("icon-user-home"),
        contractHint: null,
        salaryText: salary && !/a combinar/i.test(salary) ? salary : null,
        postedAt: date ? new Date(`${date.replace(/\//g, "-").replace(" ", "T")}-03:00`) : null,
        descriptionText: texts[texts.length - 1] ?? null,
      });
    });
    return jobs;
  },
};
