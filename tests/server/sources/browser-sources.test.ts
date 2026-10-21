import { describe, expect, it } from "vitest";
import { readEmbeddedJson } from "@/server/sources/embedded-json";
import { glassdoorSource } from "@/server/sources/glassdoor";
import { createHttp, HttpError } from "@/server/sources/http";
import { indeedSource } from "@/server/sources/indeed";
import { fixtureBrowser, sourceFixture } from "../../helpers/http";

// Estas fontes não usam o cliente HTTP: qualquer requisição direta é erro.
const http = createHttp({
  retries: 0,
  fetchImpl: (async () => {
    throw new Error("requisição direta não esperada");
  }) as unknown as typeof fetch,
});

describe("readEmbeddedJson", () => {
  it("reads the object up to its closing brace, ignoring braces and quotes inside strings", () => {
    const text = 'x = {"a":"}{ \\"q\\"","b":{"c":[1,2]}};y = {"z":1};';
    expect(readEmbeddedJson(text, 4)).toEqual({ a: '}{ "q"', b: { c: [1, 2] } });
  });

  it("returns null when there is no valid object at the position", () => {
    expect(readEmbeddedJson("x = [1]", 4)).toBeNull();
    expect(readEmbeddedJson('x = {"a":1', 4)).toBeNull();
    expect(readEmbeddedJson("x = {a:1}", 4)).toBeNull();
  });
});

describe("indeed", () => {
  const search = (keywords = "desenvolvedor react", location: string | null = null, page = 1) => {
    const ctx = fixtureBrowser([[/br\.indeed\.com\/jobs\?/, sourceFixture("indeed-search.html")]]);
    return { ctx, jobs: indeedSource.search({ keywords, location }, page, http, ctx) };
  };

  it("parses the embedded job cards", async () => {
    const jobs = await search().jobs;
    expect(jobs).toHaveLength(4);
    for (const j of jobs) {
      expect(j.source).toBe("indeed");
      expect(j.url).toBe(`https://br.indeed.com/viewjob?jk=${j.sourceJobId}`);
      expect(j.company).toBeTruthy();
      expect(j.postedAt).toBeInstanceOf(Date);
      expect(j.descriptionText).not.toMatch(/</);
    }
    expect(jobs[0]).toMatchObject({
      sourceJobId: "5d448af95d9b8d4b",
      title: "Desenvolvedor Frontend React Pleno",
      company: "Deliver IT",
      location: "Remoto",
      workModelHint: "Home Office",
      contractHint: "Tempo Integral, Efetivo/CLT, Tempo integral",
      salaryText: null,
    });
  });

  it("keeps salary text, hybrid hint and on-site jobs without remote hint", async () => {
    const byId = Object.fromEntries((await search().jobs).map((j) => [j.sourceJobId, j]));
    expect(byId["534322e7ec50ed07"].salaryText).toBe("R$ 5.500 – R$ 7.000 por mês");
    expect(byId["7df155b836142f7d"].workModelHint).toBe("Home Office, Modelo Híbrido");
    expect(byId["744b5a5716441339"]).toMatchObject({ location: "Balneário Camboriú, SC", workModelHint: null });
  });

  it("opens the search with keywords, location and page in the bridge browser", async () => {
    const first = search("desenvolvedor sênior", "São Paulo");
    await first.jobs;
    expect(first.ctx.calls).toEqual([
      { url: "https://br.indeed.com/jobs?q=desenvolvedor+s%C3%AAnior&l=S%C3%A3o+Paulo", waitFor: "[data-jk]" },
    ]);
    const second = search("php", null, 2);
    await second.jobs;
    expect(second.ctx.calls[0].url).toBe("https://br.indeed.com/jobs?q=php&start=10");
  });

  it("returns empty when the page has no job cards", async () => {
    const ctx = fixtureBrowser([[/indeed/, "<html><body>Nenhuma vaga</body></html>"]]);
    expect(await indeedSource.search({ keywords: "x", location: null }, 1, http, ctx)).toEqual([]);
  });

  it("needs the bridge browser", async () => {
    await expect(indeedSource.search({ keywords: "x", location: null }, 1, http)).rejects.toBeInstanceOf(HttpError);
  });

  it("fetches the full description from the job page", async () => {
    const ctx = fixtureBrowser([[/br\.indeed\.com\/viewjob\?jk=e3c388b29d3368a3$/, sourceFixture("indeed-detail.html")]]);
    const text = await indeedSource.fetchDetail!("https://br.indeed.com/viewjob?jk=e3c388b29d3368a3", http, ctx);
    expect(text).toContain("Modalidade de trabalho: Home Office");
    expect(text).toContain("Experiência sólida com React");
    expect(text).not.toMatch(/<|\\u003C/);
  });

  it("detail is null without job key or description", async () => {
    const ctx = fixtureBrowser([[/viewjob/, "<html><body>sem dados</body></html>"]]);
    expect(await indeedSource.fetchDetail!("https://br.indeed.com/empresa", http, ctx)).toBeNull();
    expect(await indeedSource.fetchDetail!("https://br.indeed.com/viewjob?jk=abc123", http, ctx)).toBeNull();
    expect(ctx.calls).toHaveLength(1);
  });
});

describe("glassdoor", () => {
  const ctxWith = (html = sourceFixture("glassdoor-search.html")) => fixtureBrowser([[/glassdoor\.com\.br\/Vaga\//, html]]);

  it("parses job cards", async () => {
    const ctx = ctxWith();
    const jobs = await glassdoorSource.search({ keywords: "desenvolvedor react", location: null }, 1, http, ctx);
    expect(jobs).toHaveLength(3);
    for (const j of jobs) {
      expect(j.source).toBe("glassdoor");
      expect(j.url).toMatch(/^https:\/\/www\.glassdoor\.com\.br\/job-listing\/.+\?jl=\d+$/);
      expect(j.url).toContain(`jl=${j.sourceJobId}`);
      expect(j.postedAt).toBeInstanceOf(Date);
      expect(j.descriptionText).toContain("Habilidades:");
      expect(j.descriptionText).not.toContain("&hellip;");
    }
    expect(jobs[0]).toMatchObject({
      sourceJobId: "1010299790920",
      title: "Desenvolvedor Full Stack Junior",
      company: "Spy Leilões",
      location: "Ribeirão Preto",
      salaryText: "R$ 2.800 - R$ 4.000",
    });
    expect(jobs[1]).toMatchObject({ location: "Trabalho remoto", workModelHint: "Trabalho remoto", salaryText: null });
    expect(Date.now() - jobs[0].postedAt!.getTime()).toBeCloseTo(2 * 86_400_000, -5);
    expect(Date.now() - jobs[2].postedAt!.getTime()).toBeCloseTo(30 * 86_400_000, -5);
  });

  it("builds the Brazil-wide search path with the keyword span", async () => {
    const ctx = ctxWith();
    await glassdoorSource.search({ keywords: "desenvolvedor react", location: "São Paulo" }, 1, http, ctx);
    await glassdoorSource.search({ keywords: "Engenheiro de Dados Sênior", location: null }, 1, http, ctx);
    expect(ctx.calls.map((c) => c.url)).toEqual([
      "https://www.glassdoor.com.br/Vaga/brasil-desenvolvedor-react-vagas-SRCH_IL.0,6_IN36_KO7,26.htm",
      "https://www.glassdoor.com.br/Vaga/brasil-engenheiro-de-dados-senior-vagas-SRCH_IL.0,6_IN36_KO7,33.htm",
    ]);
    expect(ctx.calls[0].waitFor).toBe('[data-test="jobListing"]');
  });

  it("drops Glassdoor salary estimates (not an offer)", async () => {
    const html = sourceFixture("glassdoor-search.html").replace("(fornecido pela empresa)", "(estimativa do Glassdoor)");
    const jobs = await glassdoorSource.search({ keywords: "x", location: null }, 1, http, ctxWith(html));
    expect(jobs[0].salaryText).toBeNull();
  });

  it("has no detail fetch (job pages ask for anti-bot verification)", () => {
    expect(glassdoorSource.fetchDetail).toBeUndefined();
  });
});
