import { SOURCE_LABELS } from "./labels";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

type RemotarJob = {
  id: number;
  title: string;
  description?: string | null;
  companyDisplayName?: string | null;
  company?: { name?: string } | null;
  city?: string | null;
  state?: string | null;
  country?: { name?: string } | null;
  type?: string | null;
  active?: boolean;
  expired?: boolean;
  createdAt?: string;
  jobSalary?: { from?: number | null; to?: number | null; currency?: string | null; type?: string } | null;
  jobTags?: { tag?: { name?: string } }[];
  jobRequirements?: { description?: string }[];
  jobBenefits?: { description?: string }[];
};

const BASE = "https://remotar.com.br";
const CONTRACT = new Set(["CLT", "PJ", "Freelancer", "Estágio", "Jovem Aprendiz"]);
const LEVEL = new Set(["Júnior", "Pleno", "Sênior"]);

/** "💼 CLT" → "CLT": as tags vêm com emoji na frente. */
const tagName = (name = "") => name.replace(/[^\p{L}\p{N}%+ ]/gu, "").trim();

/** Valores em centavos (o site divide por 100); "uninformed" e "toMatch" (a combinar) ficam sem salário. */
function salaryText(s: RemotarJob["jobSalary"]): string | null {
  if (!s || s.type === "uninformed" || s.type === "toMatch") return null;
  const lo = (Number(s.from) || 0) / 100;
  const hi = (Number(s.to) || 0) / 100;
  return formatSalaryRange(lo === hi ? null : lo, hi, s.currency ?? "BRL", s.type);
}

const list = (label: string, items: { description?: string }[] = []) => {
  const lines = items.map((i) => (i.description ? htmlToText(i.description) : "")).filter(Boolean);
  return lines.length ? `${label}:\n${lines.map((l) => `- ${l}`).join("\n")}` : null;
};

/** API pública que a própria busca do site chama: 50 vagas por página, mais recentes primeiro, descrição completa. */
export const remotarSource: JobSource = {
  id: "remotar",
  label: SOURCE_LABELS.remotar,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 1,
  async search(q, page, http) {
    const data = await http.getJson<{ data?: RemotarJob[] }>(
      `https://api.remotar.com.br/jobs?search=${encodeURIComponent(q.keywords)}${page > 1 ? `&page=${page}` : ""}`,
    );
    return (data.data ?? [])
      .filter((j) => j.id && j.title && j.active !== false && !j.expired)
      .map((j): RawJob => {
        const tags = (j.jobTags ?? []).map((t) => tagName(t.tag?.name));
        const level = tags.filter((t) => LEVEL.has(t));
        return {
          source: "remotar",
          sourceJobId: String(j.id),
          url: `${BASE}/job/${j.id}`,
          title: j.title.trim(),
          company: j.companyDisplayName?.trim() || j.company?.name?.trim() || null,
          location: [j.city, j.state].filter(Boolean).join(" - ") || j.country?.name || null,
          workModelHint: j.type ?? null,
          contractHint: tags.filter((t) => CONTRACT.has(t)).join(", ") || null,
          salaryText: salaryText(j.jobSalary),
          postedAt: j.createdAt ? new Date(j.createdAt) : null,
          descriptionText:
            [
              level.length ? `Senioridade: ${level.join("/")}.` : null,
              j.description ? htmlToText(j.description) : null,
              list("Requisitos", j.jobRequirements),
              list("Benefícios", j.jobBenefits),
            ]
              .filter(Boolean)
              .join("\n") || null,
        };
      });
  },
};
