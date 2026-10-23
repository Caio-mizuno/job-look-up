import * as cheerio from "cheerio";
import { readEmbeddedJson } from "./embedded-json";
import { jobPostingText } from "./json-ld";
import { SOURCE_LABELS } from "./labels";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://www.geekhunter.com";

type GhSalary = { contractType?: string; minSalary?: number | null; maxSalary?: number | null; currency?: string };

type GhJob = {
  id?: string;
  atsJob?: {
    jobSlug?: string;
    publishedAt?: string;
    company?: { slug?: string };
    atsJobDetail?: {
      title?: string;
      description?: string;
      experienceLevel?: string;
      workModality?: string;
      atsJobSalaries?: GhSalary[];
      atsJobSkills?: { atsSkill?: { name?: string } }[];
      atsJobCities?: { name?: string | null; city?: { name?: string | null } | null }[];
    };
  };
};

type GhListing = { data?: GhJob[]; meta?: { __typename?: string } };

const LEVEL: Record<string, string> = {
  intern: "Estágio",
  assistent: "Assistente",
  entry: "Júnior",
  mid: "Pleno",
  senior: "Sênior",
  coordinator: "Líder/Coordenador",
  manager: "Gerente",
  director: "Diretor",
  executive: "Executivo (C-Level/VP)",
};

const WORK_MODEL: Record<string, string> = {
  remote: "Remoto",
  "remote-in-city": "Remoto (na cidade)",
  hybrid: "Híbrido",
  "on-site": "Presencial",
};

/** String do payload RSC: "$$x" é um "$x" escapado; "$..." sozinho é referência (ex.: texto longo) e fica de fora. */
const rsc = (v: unknown): string => (typeof v === "string" && !/^\$(?!\$)/.test(v) ? v.replace(/^\$\$/, "$").trim() : "");

/** Junta os pedaços do payload RSC (`self.__next_f.push([1,"..."])`) num texto só. */
function rscPayload(html: string): string {
  const $ = cheerio.load(html);
  return $("script")
    .map((_, el) => {
      const m = /^self\.__next_f\.push\((\[1,[\s\S]*\])\)$/.exec($(el).text().trim());
      if (!m) return "";
      try {
        return (JSON.parse(m[1]) as [number, string])[1];
      } catch {
        return "";
      }
    })
    .get()
    .join("");
}

/** Props da lista de vagas: o objeto `{"data":[...],"meta":{PaginationMeta}}` dentro do payload. */
function listingJobs(payload: string): GhJob[] {
  for (let at = payload.indexOf('{"data":['); at >= 0; at = payload.indexOf('{"data":[', at + 1)) {
    const obj = readEmbeddedJson(payload, at) as GhListing | null;
    if (obj?.meta?.__typename === "PaginationMeta") return obj.data ?? [];
  }
  return [];
}

/** A listagem só traz o slug da empresa ("mv-saude-digital", "randstad-1"): vira nome legível, sem acentos. */
function companyFromSlug(slug: string): string | null {
  if (/^confiden/.test(slug)) return null;
  return (
    slug
      .replace(/-\d+$/, "")
      .split("-")
      .filter(Boolean)
      .map((w, i) => (i > 0 && /^(e|de|da|do|das|dos|of|for|and)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
      .join(" ") || null
  );
}

/** Uma faixa por regime (CLT, PJ), sempre mensal; mínimo igual ao máximo vira valor único. */
function salaryText(salaries: GhSalary[]): string | null {
  const parts = salaries.flatMap((s) => {
    const text = formatSalaryRange(s.minSalary === s.maxSalary ? null : s.minSalary, s.maxSalary, rsc(s.currency) || "BRL", "monthly");
    return text ? [{ contract: rsc(s.contractType), text }] : [];
  });
  if (parts.length < 2) return parts[0]?.text ?? null;
  return parts.map((p) => (p.contract ? `${p.contract}: ${p.text}` : p.text)).join(" · ");
}

/**
 * Next.js (App Router): a busca já vem renderizada no servidor e as vagas completas ficam no payload RSC.
 * Sem nome da empresa na listagem (só o slug); a descrição completa sai do JSON-LD JobPosting do detalhe.
 */
export const geekhunterSource: JobSource = {
  id: "geekhunter",
  label: SOURCE_LABELS.geekhunter,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, _page, http) {
    const html = await http.getText(`${BASE}/pt/vagas?searchTerm=${encodeURIComponent(q.keywords)}`);
    return listingJobs(rscPayload(html)).flatMap((j): RawJob[] => {
      const job = j.atsJob;
      const d = job?.atsJobDetail;
      const title = rsc(d?.title);
      const jobSlug = rsc(job?.jobSlug);
      const companySlug = rsc(job?.company?.slug);
      if (!d || !title || !jobSlug || !companySlug) return [];
      const salaries = d.atsJobSalaries ?? [];
      const level = LEVEL[rsc(d.experienceLevel)];
      const skills = (d.atsJobSkills ?? []).map((s) => rsc(s.atsSkill?.name)).filter(Boolean);
      const snippet = rsc(d.description);
      const publishedAt = Number(rsc(job?.publishedAt));
      return [
        {
          source: "geekhunter",
          sourceJobId: rsc(j.id) || null,
          url: `${BASE}/pt/${companySlug}/jobs/${jobSlug}`,
          title,
          company: companyFromSlug(companySlug),
          location: (d.atsJobCities ?? []).map((c) => rsc(c.name) || rsc(c.city?.name)).filter(Boolean).join(" / ") || null,
          workModelHint: WORK_MODEL[rsc(d.workModality)] ?? null,
          contractHint: [...new Set(salaries.map((s) => rsc(s.contractType)).filter(Boolean))].join(", ") || null,
          salaryText: salaryText(salaries),
          postedAt: publishedAt ? new Date(publishedAt) : null,
          descriptionText:
            [
              level && `Senioridade: ${level}.`,
              skills.length > 0 && `Tecnologias: ${skills.join(", ")}.`,
              snippet && htmlToText(snippet),
            ]
              .filter(Boolean)
              .join("\n") || null,
        },
      ];
    });
  },
  async fetchDetail(url, http) {
    if (!url.startsWith(`${BASE}/`)) return null;
    return jobPostingText(await http.getText(url));
  },
};
