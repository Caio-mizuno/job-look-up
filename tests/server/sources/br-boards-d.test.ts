import { describe, expect, it } from "vitest";
import { coodeshSource } from "@/server/sources/coodesh";
import { remotarSource } from "@/server/sources/remotar";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const q = (keywords: string) => ({ keywords, location: null });

describe("Coodesh", () => {
  it("reads the jobs sitemap once and filters slugs locally", async () => {
    const http = fixtureHttp([[/coodesh\.com\/sitemaps\/jobs\.xml/, sourceFixture("coodesh-search.xml")]]);
    const jobs = await coodeshSource.search(q("java sênior"), 1, http);
    await coodeshSource.search(q("analista"), 1, http);
    expect(http.urls).toEqual(["https://coodesh.com/sitemaps/jobs.xml"]);
    expect(jobs.map((j) => j.title)).toEqual([
      "Backend java senior",
      "Senior software engineer full stack kids and families",
      "Engenharia de software backend senior hibrido sao paulo",
    ]);
    expect(jobs[0]).toMatchObject({
      source: "coodesh",
      sourceJobId: "backend-java-senior-173839133",
      url: "https://coodesh.com/jobs/backend-java-senior-173839133",
      title: "Backend java senior",
      company: null,
      location: null,
      salaryText: null,
      descriptionText: null,
    });
    expect(jobs.every((j) => /^https:\/\/coodesh\.com\/jobs\/[a-z0-9-]+-\d+$/.test(j.url))).toBe(true);
    expect(jobs[0].postedAt?.toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(coodeshSource.cacheTtlMs).toBe(21_600_000);
  });

  it("returns [] for an empty sitemap", async () => {
    const empty = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    const http = fixtureHttp([[/coodesh\.com/, empty]]);
    expect(await coodeshSource.search(q("react"), 1, http)).toEqual([]);
  });

  it("fetchDetail turns the JobPosting JSON-LD into plain text", async () => {
    const http = fixtureHttp([[/coodesh\.com\/jobs\//, sourceFixture("coodesh-detail.html")]]);
    const text = await coodeshSource.fetchDetail!("https://coodesh.com/jobs/backend-java-senior-173839133", http);
    expect(http.urls).toEqual(["https://coodesh.com/jobs/backend-java-senior-173839133"]);
    expect(text).toContain("Vaga: Backend Java Sênior.\nEmpresa: Orla.\nSalário: R$ 8.000 – 15.000/mês.\nPublicada em: 2026-03-10.");
    expect(text).toContain("Forte experiência em Java e ecossistema Spring.");
    expect(text).not.toMatch(/<\/?(p|li|h\d|strong)>/);
    const none = fixtureHttp([[/coodesh\.com/, "<html><head><title>x</title></head></html>"]]);
    expect(await coodeshSource.fetchDetail!("https://coodesh.com/jobs/x-1", none)).toBeNull();
  });
});

describe("Remotar", () => {
  it("uses the public search API and maps fields, tags and salary", async () => {
    const http = fixtureHttp([[/api\.remotar\.com\.br\/jobs/, sourceFixture("remotar-search.json")]]);
    const jobs = await remotarSource.search(q("react"), 1, http);
    expect(http.urls[0]).toBe("https://api.remotar.com.br/jobs?search=react");
    expect(jobs).toHaveLength(4);
    expect(jobs[1]).toMatchObject({
      source: "remotar",
      sourceJobId: "167703",
      url: "https://remotar.com.br/job/167703",
      title: "Senior Software Engineer (Full Stack)",
      company: "Trampay",
      location: null,
      workModelHint: "remote",
      contractHint: "PJ",
      salaryText: "R$ 10.000 – 13.000/mês",
    });
    expect(jobs[1].postedAt?.toISOString()).toBe("2026-10-22T23:46:46.761Z");
    expect(jobs[1].descriptionText).toMatch(/^Senioridade: Sênior\.\n/);
    expect(jobs[1].descriptionText).toContain("Requisitos:\n- ");
    expect(jobs[1].descriptionText).not.toMatch(/<\/?(p|li|ul|h\d)>/);
    expect(jobs[0]).toMatchObject({ company: "Hand Talk", contractHint: "CLT", salaryText: null });
    expect(jobs[2].salaryText).toBeNull(); // "A combinar"
    expect(jobs[3].salaryText).toBe("R$ 28.992/mês"); // de = até
    expect(jobs.every((j) => /^https:\/\/remotar\.com\.br\/job\/\d+$/.test(j.url))).toBe(true);
  });

  it("encodes multi-word keywords, pages and maps hybrid location", async () => {
    const data = JSON.parse(sourceFixture("remotar-search.json"));
    Object.assign(data.data[0], { type: "hybrid", city: "São Paulo", state: "SP" });
    const http = fixtureHttp([[/api\.remotar\.com\.br/, JSON.stringify(data)]]);
    const [job] = await remotarSource.search(q("desenvolvedor sênior"), 2, http);
    expect(http.urls[0]).toBe("https://api.remotar.com.br/jobs?search=desenvolvedor%20s%C3%AAnior&page=2");
    expect(job).toMatchObject({ location: "São Paulo - SP", workModelHint: "hybrid" });
  });

  it("returns [] when the API has no jobs", async () => {
    const http = fixtureHttp([[/api\.remotar\.com\.br/, JSON.stringify({ meta: { total: 0 }, data: [] })]]);
    expect(await remotarSource.search(q("cobol"), 1, http)).toEqual([]);
  });
});
