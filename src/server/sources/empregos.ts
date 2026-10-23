import * as cheerio from "cheerio";
import { SOURCE_LABELS } from "./labels";
import { normalizeText } from "./match";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.empregos.com.br";

type EmpregosJob = {
  referenceId?: number;
  title?: string;
  description?: string | null;
  workplaceTypes?: string | null;
  contractForm?: string | null;
  createdAt?: string | null;
  salary?: { min?: number | null; max?: number | null } | null;
  company?: { name?: string | null } | null;
  location?: { city?: string | null; stateAbbreviation?: string | null }[] | null;
};

type NuxtPayload = { data?: Record<string, { jobCollection?: EmpregosJob[] } | null> };

const slug = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Payload do Nuxt 3 (devalue): array plano em que objetos e arrays guardam índices de outros itens. */
function unflatten(values: unknown[]): unknown {
  const memo = new Map<number, unknown>();
  const at = (i: unknown): unknown => {
    if (typeof i !== "number" || i < 0) return undefined; // negativos: undefined, NaN, Infinity…
    if (memo.has(i)) return memo.get(i);
    const v = values[i];
    if (Array.isArray(v) && typeof v[0] === "string") {
      // Tipos marcados: ["ShallowReactive", i], ["Ref", i]… só os invólucros interessam.
      const out = /^(Shallow)?(Reactive|Ref)$/.test(v[0]) ? at(v[1]) : null;
      memo.set(i, out);
      return out;
    }
    if (Array.isArray(v)) {
      const out: unknown[] = [];
      memo.set(i, out);
      for (const x of v) out.push(at(x));
      return out;
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      memo.set(i, out);
      for (const [k, x] of Object.entries(v)) out[k] = at(x);
      return out;
    }
    memo.set(i, v);
    return v;
  };
  return at(0);
}

/** Valores mensais em R$; 0/null = não informado; mínimo igual ao máximo vira valor único. */
const salaryText = (min?: number | null, max?: number | null) =>
  formatSalaryRange(min === max ? null : min, max, "BRL", "monthly");

/**
 * Página de busca do Nuxt: as vagas vêm prontas no __NUXT_DATA__, com descrição completa.
 * O local do perfil fica de fora: o filtro do site é por raio e cortaria vagas remotas de outras cidades.
 */
export const empregosSource: JobSource = {
  id: "empregos",
  label: SOURCE_LABELS.empregos,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, page, http) {
    const html = await http.getText(`${BASE}/vagas/${slug(q.keywords)}${page > 1 ? `/${page}` : ""}`);
    const $ = cheerio.load(html);
    const raw = $("#__NUXT_DATA__").text();
    if (!raw) return [];
    let payload: NuxtPayload | null = null;
    try {
      const values: unknown = JSON.parse(raw);
      payload = Array.isArray(values) ? (unflatten(values) as NuxtPayload) : null;
    } catch {
      return [];
    }
    const list = Object.values(payload?.data ?? {}).find((d) => Array.isArray(d?.jobCollection))?.jobCollection ?? [];
    // Link com slug, como o card monta; sem ele, /vaga/<id> também abre a vaga.
    const links = new Map<string, string>();
    $('a[href^="/vaga/"]').each((_, a) => {
      const href = $(a).attr("href") ?? "";
      const id = /^\/vaga\/(\d+)\//.exec(href)?.[1];
      if (id && !links.has(id)) links.set(id, href);
    });
    return list.flatMap((j): RawJob[] => {
      const title = j.title?.replace(/\s+/g, " ").trim();
      if (!j.referenceId || !title) return [];
      const id = String(j.referenceId);
      const loc = j.location?.[0];
      const contract = j.contractForm?.trim();
      return [
        {
          source: "empregos",
          sourceJobId: id,
          url: `${BASE}${links.get(id) ?? `/vaga/${id}`}`,
          title,
          company: j.company?.name?.trim() || null,
          location: [loc?.city?.trim(), loc?.stateAbbreviation].filter(Boolean).join(" - ") || null,
          workModelHint: j.workplaceTypes?.trim() || null,
          contractHint: contract && !/a combinar/i.test(contract) ? contract : null,
          salaryText: salaryText(j.salary?.min, j.salary?.max),
          postedAt: j.createdAt ? new Date(`${j.createdAt}-03:00`) : null, // horário de Brasília, sem fuso
          descriptionText: j.description ? htmlToText(j.description) || null : null,
        },
      ];
    });
  },
};
