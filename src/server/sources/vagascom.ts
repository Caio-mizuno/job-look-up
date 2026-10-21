import * as cheerio from "cheerio";
import { SOURCE_LABELS } from "./labels";
import { normalizeText } from "./match";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.vagas.com.br";

const slug = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "24/09/2026" → data; "Hoje"/"Há N dias" → relativo a agora. */
function parseDate(text: string, now = Date.now()): Date | null {
  const abs = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (abs) return new Date(`${abs[3]}-${abs[2]}-${abs[1]}T12:00:00-03:00`);
  const t = normalizeText(text);
  if (t.includes("hoje")) return new Date(now);
  if (t.includes("ontem")) return new Date(now - 86_400_000);
  const days = /ha (\d+) dia/.exec(t);
  return days ? new Date(now - Number(days[1]) * 86_400_000) : null;
}

export const vagascomSource: JobSource = {
  id: "vagascom",
  label: SOURCE_LABELS.vagascom,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, _page, http) {
    const html = await http.getText(`${BASE}/vagas-de-${slug(q.keywords)}`);
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];
    $("li.vaga").each((_, el) => {
      const li = $(el);
      const a = li.find("a.link-detalhes-vaga").first();
      const href = a.attr("href");
      const title = (a.attr("title") ?? a.text()).trim();
      if (!href || !title) return;
      const level = li.find(".nivelVaga").text().trim();
      const snippet = li.find(".detalhes").text().replace(/\s+/g, " ").trim();
      const location =
        li.find(".vaga-local").clone().children(".tooltip-place").remove().end().text().replace(/\s+/g, " ").trim() || null;
      jobs.push({
        source: "vagascom",
        sourceJobId: a.attr("data-id-vaga") ?? null,
        url: `${BASE}${href}`,
        title,
        company: li.find(".emprVaga").text().trim() || null,
        location,
        workModelHint: location,
        contractHint: null,
        salaryText: null,
        postedAt: parseDate(li.find(".data-publicacao").text()),
        descriptionText: [level && `Senioridade: ${level}.`, snippet].filter(Boolean).join("\n") || null,
      });
    });
    return jobs;
  },
};
