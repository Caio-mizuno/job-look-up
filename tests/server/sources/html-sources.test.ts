import { describe, expect, it } from "vitest";
import { gupySource } from "@/server/sources/gupy";
import { linkedinSource } from "@/server/sources/linkedin";
import { programathorSource } from "@/server/sources/programathor";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

describe("gupy", () => {
  it("parses fixture", async () => {
    const http = fixtureHttp([[/portal\.gupy\.io/, sourceFixture("gupy-search.html")]]);
    const jobs = await gupySource.search({ keywords: "desenvolvedor full stack", location: null }, 1, http);
    expect(jobs).toHaveLength(3);
    for (const j of jobs) {
      expect(j.source).toBe("gupy");
      expect(j.url).toMatch(/^https:\/\/[a-z0-9-]+\.gupy\.io\/job\//);
      expect(j.title.length).toBeGreaterThan(3);
      expect(j.company).toBeTruthy();
      expect(j.postedAt).toBeInstanceOf(Date);
      expect(j.descriptionText?.length).toBeGreaterThan(50);
    }
    expect(jobs[0].workModelHint).toBe("hybrid");
    expect(["CLT", "PJ", null]).toContain(jobs[0].contractHint);
  });

  it("encodes accents in term", async () => {
    const http = fixtureHttp([[/portal\.gupy\.io/, sourceFixture("gupy-search.html")]]);
    await gupySource.search({ keywords: "desenvolvedor sênior", location: null }, 1, http);
    expect(http.urls[0]).toContain("term=desenvolvedor%20s%C3%AAnior");
  });

  it("returns empty when there is no job list", async () => {
    const http = fixtureHttp([[/portal\.gupy\.io/, "<html><body>nada</body></html>"]]);
    expect(await gupySource.search({ keywords: "x", location: null }, 1, http)).toEqual([]);
  });
});

describe("programathor", () => {
  it("parses list with company, location, contract, salary and tags", async () => {
    const http = fixtureHttp([[/programathor\.com\.br\/jobs\?/, sourceFixture("programathor-search.html")]]);
    const jobs = await programathorSource.search({ keywords: "php", location: null }, 1, http);
    expect(jobs).toHaveLength(4);
    const first = jobs[0];
    expect(first.url).toMatch(/^https:\/\/programathor\.com\.br\/jobs\/\d+-/);
    expect(first.sourceJobId).toMatch(/^\d+$/);
    expect(first.company).toBeTruthy();
    expect(first.descriptionText).toContain("Tecnologias:");
    expect(jobs.some((j) => j.salaryText?.includes("R$"))).toBe(true);
    expect(http.urls[0]).toBe("https://programathor.com.br/jobs?search=php&page=1");
  });

  it("drops badge text like NOVA from the title", async () => {
    const http = fixtureHttp([[/programathor\.com\.br\/jobs\?/, sourceFixture("programathor-search.html")]]);
    const jobs = await programathorSource.search({ keywords: "php", location: null }, 1, http);
    expect(jobs.map((j) => j.title)).toContain("Game Developer (USD-based pay)");
    expect(jobs.every((j) => !/NOVA$/.test(j.title))).toBe(true);
  });

  it("has no detail fetch (detail pages block HTTP clients)", () => {
    expect(programathorSource.fetchDetail).toBeUndefined();
  });
});

describe("linkedin", () => {
  it("is disabled by default", () => {
    expect(linkedinSource.defaultEnabled).toBe(false);
  });

  it("parses list and builds paged url", async () => {
    const http = fixtureHttp([[/seeMoreJobPostings/, sourceFixture("linkedin-search.html")]]);
    const jobs = await linkedinSource.search({ keywords: "laravel", location: "Brasil" }, 2, http);
    expect(http.urls[0]).toContain("keywords=laravel");
    expect(http.urls[0]).toContain("location=Brasil");
    expect(http.urls[0]).toContain("start=10");
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      sourceJobId: "4012345678",
      title: "Desenvolvedor Laravel Sênior",
      company: "Empresa Alfa",
      location: "São Paulo, SP (Remoto)",
    });
    expect(jobs[0].postedAt?.toISOString().slice(0, 10)).toBe("2026-10-18");
    expect(jobs[1].postedAt?.toISOString().slice(0, 10)).toBe("2026-10-20");
  });

  it("fetches detail text", async () => {
    const http = fixtureHttp([[/jobPosting\/4012345678/, sourceFixture("linkedin-detail.html")]]);
    const text = await linkedinSource.fetchDetail!("https://br.linkedin.com/jobs/view/x-4012345678?trackingId=1", http);
    expect(text).toContain("Laravel 10+");
    expect(text).not.toContain("<li>");
  });
});
