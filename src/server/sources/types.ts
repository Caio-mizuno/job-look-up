import type { Http } from "./http";

export type SourceId =
  | "gupy"
  | "programathor"
  | "vagascom"
  | "infojobs"
  | "remotive"
  | "remoteok"
  | "himalayas"
  | "weworkremotely"
  | "workingnomads"
  | "jobicy"
  | "arbeitnow"
  | "linkedin";

export type SearchQuery = { keywords: string; location: string | null };

export type RawJob = {
  source: SourceId;
  sourceJobId: string | null;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  workModelHint: string | null;
  contractHint: string | null;
  salaryText: string | null;
  postedAt: Date | null;
  descriptionText: string | null;
};

export interface JobSource {
  id: SourceId;
  label: string;
  /** Site da fonte: link de atribuição no card. */
  homepage: string;
  defaultEnabled: boolean;
  maxPages: number;
  cacheTtlMs?: number;
  userAgent?: string;
  search(q: SearchQuery, page: number, http: Http): Promise<RawJob[]>;
  fetchDetail?(url: string, http: Http): Promise<string | null>;
}
