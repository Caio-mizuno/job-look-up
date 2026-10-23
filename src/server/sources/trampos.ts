import { SOURCE_LABELS } from "./labels";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://trampos.co";

type TramposJob = {
  id: number;
  name?: string;
  type_name?: string;
  category_name?: string;
  city?: string | null;
  state?: string | null;
  home_office?: boolean;
  hybrid?: boolean;
  salary?: string | null;
  published_at?: string | null;
  custom_company_name?: string | null;
  company?: { name?: string | null } | null;
};

type TramposDetail = Partial<
  Record<"description" | "regime" | "prerequisite" | "desirable" | "perks" | "other_info", string | null>
>;

const DETAIL_SECTIONS: [keyof TramposDetail, string][] = [
  ["prerequisite", "Pré-requisitos"],
  ["desirable", "Desejável"],
  ["perks", "Benefícios"],
  ["other_info", "Outras informações"],
];

/** A página (Ember) monta a lista no navegador a partir da API JSON pública v2: busca livre em `tr`, 12 vagas por página. */
export const tramposSource: JobSource = {
  id: "trampos",
  label: SOURCE_LABELS.trampos,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 2,
  async search(q, page, http) {
    const data = await http.getJson<{ opportunities?: TramposJob[] }>(
      `${BASE}/api/v2/opportunities?tr=${encodeURIComponent(q.keywords)}&page=${page}`,
    );
    return (data.opportunities ?? []).flatMap((o): RawJob[] => {
      const title = o.name?.trim();
      if (!o.id || !title) return [];
      const salary = o.salary?.trim();
      return [
        {
          source: "trampos",
          sourceJobId: String(o.id),
          url: `${BASE}/oportunidades/${o.id}`,
          title,
          company: (o.custom_company_name || o.company?.name)?.trim() || null,
          location: [o.city?.trim(), o.state?.trim()].filter(Boolean).join(" - ") || null,
          workModelHint: o.home_office ? "Home office" : o.hybrid ? "Híbrido" : null,
          contractHint: o.type_name?.trim() || null,
          salaryText: salary && !/n[ãa]o divulgad/i.test(salary) ? salary : null,
          postedAt: o.published_at ? new Date(o.published_at) : null,
          descriptionText: o.category_name?.trim() ? `Área: ${o.category_name.trim()}.` : null,
        },
      ];
    });
  },
  async fetchDetail(url, http) {
    const id = /\/oportunidades\/(\d+)/.exec(url)?.[1];
    if (!id) return null;
    const { opportunity: o } = await http.getJson<{ opportunity?: TramposDetail }>(`${BASE}/api/v2/opportunities/${id}`);
    if (!o) return null;
    const text = (s: string | null | undefined) => (s ? htmlToText(s) : "");
    return (
      [
        text(o.description),
        o.regime?.trim() && `Regime: ${o.regime.trim()}.`,
        ...DETAIL_SECTIONS.map(([key, label]) => {
          const t = text(o[key]);
          return t && `${label}:\n${t}`;
        }),
      ]
        .filter(Boolean)
        .join("\n") || null
    );
  },
};
