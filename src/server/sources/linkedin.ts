import * as cheerio from "cheerio";
import { htmlToText } from "./text";
import type { JobSource, RawJob } from "./types";

const API = "https://www.linkedin.com/jobs-guest/jobs/api";

/** Endpoint público sem login. Nunca usa a conta da pessoa; pode ser bloqueado (429). */
export const linkedinSource: JobSource = {
  id: "linkedin",
  label: "LinkedIn",
  homepage: "https://www.linkedin.com/jobs",
  defaultEnabled: false,
  maxPages: 2,
  async search(q, page, http) {
    const params = new URLSearchParams({ keywords: q.keywords, start: String((page - 1) * 10) });
    if (q.location) params.set("location", q.location);
    const html = await http.getText(`${API}/seeMoreJobPostings/search?${params.toString()}`);
    const $ = cheerio.load(html);
    const jobs: RawJob[] = [];
    $(".base-search-card, .base-card").each((_, card) => {
      const urn = $(card).attr("data-entity-urn") ?? "";
      const url = $(card).find("a.base-card__full-link").attr("href");
      const title = $(card).find(".base-search-card__title").text().trim();
      if (!url || !title) return;
      const datetime = $(card).find("time").attr("datetime");
      const location = $(card).find(".job-search-card__location").text().trim() || null;
      jobs.push({
        source: "linkedin",
        sourceJobId: /jobPosting:(\d+)/.exec(urn)?.[1] ?? null,
        url,
        title,
        company: $(card).find(".base-search-card__subtitle").text().trim() || null,
        location,
        workModelHint: location,
        contractHint: null,
        salaryText: null,
        postedAt: datetime ? new Date(`${datetime}T12:00:00Z`) : null,
        descriptionText: null,
      });
    });
    return jobs;
  },
  async fetchDetail(url, http) {
    const id = /(\d{6,})(?:[/?]|$)/.exec(url)?.[1];
    if (!id) return null;
    const html = await http.getText(`${API}/jobPosting/${id}`);
    const markup = cheerio.load(html)(".show-more-less-html__markup").html();
    return markup ? htmlToText(markup) : null;
  },
};
