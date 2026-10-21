import { describe, expect, it } from "vitest";
import { arbeitnowSource } from "@/server/sources/arbeitnow";
import { himalayasSource } from "@/server/sources/himalayas";
import { SOURCES } from "@/server/sources/registry";
import { remoteokSource } from "@/server/sources/remoteok";
import { remotiveSource } from "@/server/sources/remotive";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const q = (keywords: string) => ({ keywords, location: null });

describe("remotive", () => {
  it("fetches one category feed for every query and filters titles locally", async () => {
    const http = fixtureHttp([[/remotive\.com\/api/, sourceFixture("remotive.json")]]);
    const jobs = await remotiveSource.search(q("rails"), 1, http);
    await remotiveSource.search(q("assistant"), 1, http);
    expect(http.urls[0]).toBe("https://remotive.com/api/remote-jobs?category=software-dev");
    expect(new Set(http.urls).size).toBe(1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ source: "remotive", title: "Tech Lead Full-Stack Rails Engineer", workModelHint: "remote" });
    expect(jobs[0].url).toMatch(/^https:\/\/remotive\.com\//);
    expect(jobs[0].postedAt).toBeInstanceOf(Date);
    expect(jobs[0].descriptionText).not.toMatch(/<p>/);
    expect(remotiveSource.cacheTtlMs).toBe(21_600_000);
  });
});

describe("remoteok", () => {
  it("skips legal notice element and filters by title keywords", async () => {
    const http = fixtureHttp([[/remoteok\.com\/api/, sourceFixture("remoteok.json")]]);
    const jobs = await remoteokSource.search(q("full stack"), 1, http);
    expect(http.urls[0]).toBe("https://remoteok.com/api");
    expect(jobs.map((j) => j.title)).toEqual(["Full Stack Developer"]);
    expect(jobs[0].url).toMatch(/^https:\/\/remoteok\.com\//i);
    expect(remoteokSource.label).toBe("Remote OK");
  });

  it("formats salary range when present", async () => {
    const data = JSON.parse(sourceFixture("remoteok.json"));
    data[3].salary_min = 80000;
    data[3].salary_max = 120000;
    const http = fixtureHttp([[/remoteok\.com\/api/, JSON.stringify(data)]]);
    const [job] = await remoteokSource.search(q("full stack"), 1, http);
    expect(job.salaryText).toBe("US$ 80.000 – 120.000/ano");
  });
});

describe("himalayas", () => {
  it("uses native search and maps fields", async () => {
    const http = fixtureHttp([[/himalayas\.app\/jobs\/api\/search/, sourceFixture("himalayas.json")]]);
    const jobs = await himalayasSource.search(q("php"), 1, http);
    expect(http.urls[0]).toContain("https://himalayas.app/jobs/api/search?q=php");
    expect(jobs).toHaveLength(3);
    expect(jobs[2]).toMatchObject({ title: "Senior PHP Developer", workModelHint: "remote" });
    expect(jobs[0].postedAt).toBeInstanceOf(Date);
  });
});

describe("arbeitnow", () => {
  it("filters by keywords and is disabled by default", async () => {
    const http = fixtureHttp([[/arbeitnow\.com\/api/, sourceFixture("arbeitnow.json")]]);
    const jobs = await arbeitnowSource.search(q("software engineer"), 1, http);
    expect(http.urls[0]).toBe("https://www.arbeitnow.com/api/job-board-api?page=1");
    expect(jobs.map((j) => j.title)).toEqual(["Senior Software Engineer", "Forward Deployed Engineer"]);
    expect(arbeitnowSource.defaultEnabled).toBe(false);
  });
});

describe("registry", () => {
  it("has 14 sources; LinkedIn, Arbeitnow, Indeed and Glassdoor off by default", () => {
    expect(SOURCES).toHaveLength(14);
    expect(SOURCES.filter((s) => s.defaultEnabled).map((s) => s.id)).toEqual([
      "gupy",
      "programathor",
      "vagascom",
      "infojobs",
      "remotive",
      "remoteok",
      "himalayas",
      "weworkremotely",
      "workingnomads",
      "jobicy",
    ]);
  });
});
