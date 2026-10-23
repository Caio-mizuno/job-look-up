import * as cheerio from "cheerio";
import { htmlToText } from "./text";

export type JobPosting = {
  "@type"?: string;
  title?: string;
  description?: string;
  datePosted?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string } };
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; unitText?: string } };
};

/** Primeiro JobPosting nos blocos JSON-LD da página (aceita lista e @graph); bloco inválido é pulado. */
export function readJobPosting(html: string): JobPosting | null {
  const $ = cheerio.load(html);
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const data = JSON.parse($(el).text());
      const nodes: JobPosting[] = Array.isArray(data) ? data : Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
      const job = nodes.find((n) => n?.["@type"] === "JobPosting");
      if (job) return job;
    } catch {
      // Bloco inválido: tenta o próximo.
    }
  }
  return null;
}

/** Descrição do JobPosting da página da vaga, em texto puro. */
export function jobPostingText(html: string): string | null {
  const description = readJobPosting(html)?.description;
  return description ? htmlToText(description) || null : null;
}
