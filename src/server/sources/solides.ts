import { SOURCE_LABELS } from "./labels";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const BASE = "https://vagas.solides.com.br";

type Named = { name?: string | null };

type SolidesJob = {
  id: number | string;
  title?: string;
  description?: string | null;
  companyName?: string | null;
  city?: { name?: string | null } | null;
  state?: { code?: string | null } | null;
  jobType?: string | null;
  recruitmentContractType?: Named[];
  seniority?: Named[];
  salary?: { type?: string; showRangeToApplicant?: boolean; initialRange?: number | null; finalRange?: number | null } | null;
  createdAt?: string | null;
  publishers?: { rhgestor?: { redirectUrl?: string } | null } | null;
};

const names = (xs: Named[] | undefined) =>
  (xs ?? [])
    .map((x) => x?.name?.trim() ?? "")
    .filter(Boolean)
    .join(", ");

/** Como o portal mostra: oculta sem showRangeToApplicant; "simple" usa só o valor final. */
function salaryText(s: SolidesJob["salary"]): string | null {
  if (!s?.showRangeToApplicant) return null;
  const max = s.finalRange ?? null;
  const min = s.type === "simple" || s.initialRange === max ? null : s.initialRange;
  return formatSalaryRange(min, max, "BRL", "monthly");
}

/**
 * O portal (Next.js) busca pela própria rota pública /api/vacancies: JSON com a descrição completa.
 * Vagas vindas do RH Gestor têm id alfanumérico e só abrem no link externo, como no card do site.
 */
export const solidesSource: JobSource = {
  id: "solides",
  label: SOURCE_LABELS.solides,
  homepage: BASE,
  defaultEnabled: true,
  maxPages: 2,
  async search(q, page, http) {
    const params = new URLSearchParams({ page: String(page), take: "14", title: q.keywords });
    const data = await http.getJson<{ data?: SolidesJob[] }>(`${BASE}/api/vacancies?${params.toString()}`);
    return (data.data ?? []).flatMap((j): RawJob[] => {
      const title = j.title?.replace(/\s+/g, " ").trim();
      if (j.id == null || j.id === "" || !title) return [];
      const seniority = names(j.seniority);
      const description = j.description ? htmlToText(j.description) : "";
      return [
        {
          source: "solides",
          sourceJobId: String(j.id),
          url: j.publishers?.rhgestor?.redirectUrl || `${BASE}/vaga/${j.id}`,
          title,
          company: j.companyName?.trim() || null,
          location: [j.city?.name?.trim(), j.state?.code].filter(Boolean).join(" - ") || null,
          workModelHint: j.jobType || null,
          contractHint: names(j.recruitmentContractType) || null,
          salaryText: salaryText(j.salary),
          postedAt: j.createdAt ? new Date(`${j.createdAt.slice(0, 10)}T12:00:00-03:00`) : null, // só a data
          descriptionText: [seniority && `Senioridade: ${seniority}.`, description].filter(Boolean).join("\n") || null,
        },
      ];
    });
  },
};
