import { beforeEach, describe, expect, it } from "vitest";
import { upsertJob } from "@/server/jobs/repo";
import { normalizeRawJob } from "@/server/pipeline/normalize";
import { saveQueries } from "@/server/pipeline/queries";
import { runSearch, startSearchRun } from "@/server/pipeline/search-run";
import { saveProfile } from "@/server/profile/repo";
import { LoginRequiredError } from "@/server/sources/browser";
import { createHttp } from "@/server/sources/http";
import { linkedinPostsSource } from "@/server/sources/linkedin-posts";
import type { JobSource, PageBrowser, RawJob } from "@/server/sources/types";
import { memDb } from "../../helpers/db";
import { sampleProfile } from "../../helpers/profile";

beforeEach(() => {
  process.env.APP_KEY = "c".repeat(64);
});

const NOW = Date.UTC(2026, 9, 22, 12);
const queries = ["laravel", "php", "react", "node", "next"].map((keywords) => ({ keywords, location: null }));

const raw = (over: Partial<RawJob> = {}): RawJob => ({
  source: "linkedin_posts",
  sourceJobId: "1",
  url: "https://www.linkedin.com/feed/update/urn:li:activity:1/",
  title: "Desenvolvedor PHP",
  company: "Pessoa A",
  location: null,
  workModelHint: null,
  contractHint: null,
  salaryText: null,
  postedAt: null,
  descriptionText: "texto",
  ...over,
});

describe("search run with linkedin posts", () => {
  it("fixed queries run once", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    saveQueries(db, queries, NOW);
    const seen: string[] = [];
    const posts: JobSource = {
      ...linkedinPostsSource,
      async search(q) {
        seen.push(q.keywords);
        return [];
      },
    };
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), now: () => NOW, sources: [posts] });
    expect(seen).toEqual(['"desenvolvedor" and "contratando"']);
  });

  it("login wall marks only linkedin_posts as error", async () => {
    const db = memDb();
    saveProfile(db, sampleProfile(), NOW);
    saveQueries(db, [{ keywords: "laravel", location: null }], NOW);
    const browser: PageBrowser = {
      async getHtml() {
        throw new LoginRequiredError();
      },
    };
    const gupy: JobSource = {
      id: "gupy",
      label: "Gupy",
      homepage: "https://gupy.example",
      defaultEnabled: true,
      maxPages: 1,
      async search() {
        return [raw({ source: "gupy", url: "https://a.gupy.io/job/1", company: "Acme", title: "Dev Laravel" })];
      },
    };
    const runId = startSearchRun(db, "manual", NOW);
    await runSearch(db, { runId, http: createHttp(), browser, now: () => NOW, sources: [linkedinPostsSource, gupy] });

    const run = db.$client.prepare("select status, per_source from search_runs where id = ?").get(runId) as {
      status: string;
      per_source: string;
    };
    const per = JSON.parse(run.per_source);
    expect(run.status).toBe("done");
    expect(per.linkedin_posts.status).toBe("error");
    expect(per.linkedin_posts.error).toContain("make linkedin-login");
    expect(per.gupy).toMatchObject({ status: "ok", count: 1 });
  });

  it("contact email survives a later upsert without email", () => {
    const db = memDb();
    const { id } = upsertJob(db, normalizeRawJob(raw({ contactEmail: "RH@Exemplo.com " }), NOW), NOW);
    upsertJob(db, normalizeRawJob(raw({ contactEmail: null }), NOW + 1), NOW + 1);
    const row = db.$client.prepare("select contact_email from jobs where id = ?").get(id) as { contact_email: string | null };
    expect(row.contact_email).toBe("rh@exemplo.com");
  });
});
