import * as cheerio from "cheerio";
import type { JobSource, RawJob } from "./types";

const BASE = "https://programathor.com.br";

/** Só a listagem: a página de detalhe responde 500 para clientes HTTP (verificado em 2026-10-21). */
export const programathorSource: JobSource = {
  id: "programathor",
  label: "Programathor",
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 2,
  async search(q, page, http) {
    const html = await http.getText(`${BASE}/jobs?search=${encodeURIComponent(q.keywords)}&page=${page}`);
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];
    $(".cell-list a[href^='/jobs/']").each((_, a) => {
      const href = $(a).attr("href") ?? "";
      // O h3 traz selos ("NOVA") em elementos filhos: fica só o texto próprio do título.
      const title = $(a).find("h3").first().clone().children().remove().end().text().trim();
      if (!title) return;
      const byIcon = (icon: string) =>
        $(a)
          .find(`.cell-list-content-icon span:has(i.${icon})`)
          .first()
          .text()
          .trim() || null;
      const tags = $(a)
        .find(".tag-list")
        .map((_, t) => $(t).text().trim())
        .get()
        .filter(Boolean);
      const level = byIcon("fa-chart-bar");
      const contract = byIcon("fa-file-alt");
      const location = byIcon("fa-map-marker-alt");
      const description = [
        level && `Senioridade: ${level}.`,
        contract && `Contrato: ${contract}.`,
        location && `Local: ${location}.`,
        tags.length > 0 && `Tecnologias: ${tags.join(", ")}.`,
      ]
        .filter(Boolean)
        .join("\n");
      jobs.push({
        source: "programathor",
        sourceJobId: /\/jobs\/(\d+)/.exec(href)?.[1] ?? null,
        url: `${BASE}${href}`,
        title,
        company: byIcon("fa-briefcase"),
        location,
        workModelHint: location,
        contractHint: contract,
        salaryText: byIcon("fa-money-bill-alt"),
        postedAt: null,
        descriptionText: description || null,
      });
    });
    return jobs;
  },
};
