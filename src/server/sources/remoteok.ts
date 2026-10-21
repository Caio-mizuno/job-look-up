import { matchesKeywords } from "./match";
import { formatSalaryRange } from "./salary";
import { htmlToText } from "./text";
import { SOURCE_LABELS } from "./labels";
import type { JobSource, RawJob } from "./types";

type RemoteOkJob = {
  id?: string;
  url?: string;
  position?: string;
  company?: string;
  location?: string;
  date?: string;
  description?: string;
  salary_min?: number | string;
  salary_max?: number | string;
};

/**
 * Termos da Remote OK: link de volta e crédito "Remote OK".
 * Um único GET do feed (cache de 6 h) atende todas as consultas; o filtro é local, pelo título.
 */
export const remoteokSource: JobSource = {
  id: "remoteok",
  label: SOURCE_LABELS.remoteok,
  homepage: "https://remoteok.com",
  defaultEnabled: true,
  maxPages: 1,
  cacheTtlMs: 21_600_000,
  async search(q, _page, http) {
    const feed = await http.getJson<RemoteOkJob[]>("https://remoteok.com/api", { cacheTtlMs: this.cacheTtlMs });
    // O primeiro item é o aviso legal, não uma vaga.
    return feed
      .slice(1)
      .filter((j) => j.position && j.url && matchesKeywords(j.position, q.keywords))
      .map(
        (j): RawJob => ({
          source: "remoteok",
          sourceJobId: j.id ?? null,
          url: j.url!,
          title: j.position!.trim(),
          company: j.company?.trim() || null,
          location: j.location?.trim() || null,
          workModelHint: "remote",
          contractHint: null,
          salaryText: formatSalaryRange(j.salary_min, j.salary_max, "USD", "annual"),
          postedAt: j.date ? new Date(j.date) : null,
          descriptionText: j.description ? htmlToText(j.description) : null,
        }),
      );
  },
};
