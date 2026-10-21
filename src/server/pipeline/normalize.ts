import { createHash } from "node:crypto";
import type { Contract, Seniority, WorkModel } from "@/server/domain/enums";
import { normalizeText } from "@/server/sources/match";
import type { RawJob } from "@/server/sources/types";

const TRACKING = new Set(["gclid", "fbclid", "ref", "refid", "trk", "trackingid", "src", "jobboardsource", "position", "pagenum"]);

export function canonicalUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") || TRACKING.has(k)) u.searchParams.delete(key);
  }
  return u.toString();
}

const COMPANY_SUFFIX = /\b(ltda|s\/a|s\.a\.?|sa|me|eireli|inc|ltd|llc)\.?$/;

const slug = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function normalizeCompany(company: string): string {
  let c = normalizeText(company).replace(/[.,]+$/g, "").trim();
  // Remove sufixos societários (às vezes repetidos: "Empresa Ltda ME").
  for (let i = 0; i < 2; i++) c = c.replace(COMPANY_SUFFIX, "").trim();
  return slug(c);
}

/** Mesma vaga em fontes diferentes → mesma chave. Sem empresa, a URL desempata. */
export function dedupeKey(company: string | null, title: string, urlFallback?: string): string {
  const who = company?.trim() ? normalizeCompany(company) : `url:${urlFallback ?? ""}`;
  return createHash("sha1").update(`${who}|${slug(title)}`).digest("hex").slice(0, 16);
}

export function inferWorkModel(text: string | null | undefined): WorkModel | null {
  if (!text) return null;
  const t = normalizeText(text);
  if (/\b(hibrido|hybrid)\b/.test(t)) return "hybrid";
  if (/\b(remoto|remota|remote|home office|anywhere|worldwide)\b/.test(t)) return "remote";
  if (/\b(presencial|on-site|onsite|in office|in-office)\b/.test(t)) return "onsite";
  return null;
}

export function inferContract(text: string | null | undefined): Contract | null {
  if (!text) return null;
  const t = normalizeText(text);
  if (/\bclt\b|\befetivo\b/.test(t)) return "clt";
  if (/\bpj\b|pessoa juridica/.test(t)) return "pj";
  return null;
}

export function inferSeniority(text: string | null | undefined): Seniority | null {
  if (!text) return null;
  const t = normalizeText(text);
  if (/\b(tech lead|lider|lead|head)\b/.test(t)) return "lead";
  if (/\b(especialista|staff|principal)\b/.test(t)) return "especialista";
  if (/\b(sr|senior)\b/.test(t)) return "senior";
  if (/\b(pl|pleno|mid|mid-level)\b/.test(t)) return "pleno";
  if (/\b(jr|junior|estagio|estagiario|trainee)\b/.test(t)) return "junior";
  return null;
}

export type NewJob = {
  source: string;
  sourceJobId: string | null;
  url: string;
  dedupeKey: string;
  title: string;
  company: string | null;
  location: string | null;
  workModel: WorkModel | null;
  contract: Contract | null;
  seniority: Seniority | null;
  salaryText: string | null;
  postedAt: number | null;
  descriptionText: string | null;
};

export function normalizeRawJob(raw: RawJob, _now: number): NewJob {
  const url = canonicalUrl(raw.url);
  const title = raw.title.replace(/\s+/g, " ").trim();
  const seniorityLine = /Senioridade:\s*([^.\n]+)/i.exec(raw.descriptionText ?? "")?.[1];
  return {
    source: raw.source,
    sourceJobId: raw.sourceJobId,
    url,
    dedupeKey: dedupeKey(raw.company, title, url),
    title,
    company: raw.company?.trim() || null,
    location: raw.location?.trim() || null,
    // Ordem de confiança: dica estruturada da fonte, local, título; a descrição é ruidosa demais.
    workModel: inferWorkModel(raw.workModelHint) ?? inferWorkModel(raw.location) ?? inferWorkModel(title),
    contract: inferContract(raw.contractHint) ?? inferContract(title),
    seniority: inferSeniority(title) ?? inferSeniority(seniorityLine),
    salaryText: raw.salaryText?.trim() || null,
    postedAt: raw.postedAt && !Number.isNaN(raw.postedAt.getTime()) ? raw.postedAt.getTime() : null,
    descriptionText: raw.descriptionText?.trim() || null,
  };
}
