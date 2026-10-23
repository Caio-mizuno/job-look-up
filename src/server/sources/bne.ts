import * as cheerio from "cheerio";
import { jobPostingText } from "./json-ld";
import { SOURCE_LABELS } from "./labels";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.bne.com.br";

type BneJob = {
  Id?: number;
  Titulo?: string | null;
  Function?: { Name?: string | null } | null;
  CompanyName?: string | null;
  Confidential?: boolean;
  City?: { Name?: string | null } | null;
  StateAbbreviation?: string | null;
  Home_Office?: boolean;
  AverageWage?: string | null;
  PostDate?: string | null;
  GeneralDescription?: string | null;
  Attributions?: string | null;
  Requirements?: string | null;
  PathUrlJob?: string | null;
};

/** Sem título próprio, a vaga leva o cargo do catálogo, em minúsculas ("desenvolvedor php"). */
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Horário sem fuso é de Brasília. */
const parseDate = (s: string) => new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : `${s}-03:00`);

/** A listagem traz as vagas em JSON num input escondido (#jobInfoLocal), com o texto cortado; o completo vem do JSON-LD do detalhe. */
export const bneSource: JobSource = {
  id: "bne",
  label: SOURCE_LABELS.bne,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, _page, http) {
    // Busca livre do próprio site; "/" e "+" quebram a rota (404/500).
    const keywords = q.keywords.replace(/[/+]/g, " ").replace(/\s+/g, " ").trim();
    const html = await http.getText(`${BASE}/vagas-de-emprego/${encodeURIComponent(keywords)}`);
    const raw = cheerio.load(html)("#jobInfoLocal").attr("value");
    if (!raw) return [];
    let jobs: unknown;
    try {
      jobs = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(jobs)) return [];
    return (jobs as BneJob[]).flatMap((j): RawJob[] => {
      const title = j.Titulo?.trim() || j.Function?.Name?.trim();
      if (!j.Id || !title || !j.PathUrlJob?.startsWith("/")) return [];
      const company = j.CompanyName?.trim() ?? "";
      const wage = j.AverageWage?.trim();
      const description = [j.GeneralDescription, j.Attributions, j.Requirements]
        .map((t) => (t ? htmlToText(t) : ""))
        .filter(Boolean)
        .join("\n");
      return [
        {
          source: "bne",
          sourceJobId: String(j.Id),
          url: `${BASE}${j.PathUrlJob}`,
          title: capitalize(title),
          // Confidencial (ou "****") juntaria vagas diferentes na deduplicação: o cargo é genérico.
          company: !j.Confidential && /[\p{L}\d]/u.test(company) ? company : null,
          location: [j.City?.Name?.trim(), j.StateAbbreviation?.trim()].filter(Boolean).join(" - ") || null,
          workModelHint: j.Home_Office ? "Home office" : null,
          contractHint: null,
          salaryText: wage && !/a combinar/i.test(wage) ? wage : null,
          postedAt: j.PostDate ? parseDate(j.PostDate) : null,
          descriptionText: description || null,
        },
      ];
    });
  },
  async fetchDetail(url, http) {
    if (!/^https:\/\/www\.bne\.com\.br\/vaga-de-emprego-[^/?#]+\/[^/?#]+\/\d+/.test(url)) return null;
    return jobPostingText(await http.getText(url));
  },
};
