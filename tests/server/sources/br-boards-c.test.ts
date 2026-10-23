import { describe, expect, it } from "vitest";
import { geekhunterSource } from "@/server/sources/geekhunter";
import { tramposSource } from "@/server/sources/trampos";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const q = (keywords: string) => ({ keywords, location: null });

describe("GeekHunter", () => {
  it("reads the jobs from the RSC payload (split in chunks) of the server-rendered search", async () => {
    const http = fixtureHttp([[/geekhunter\.com\/pt\/vagas/, sourceFixture("geekhunter-search.html")]]);
    const jobs = await geekhunterSource.search(q("desenvolvedor"), 1, http);
    expect(http.urls[0]).toBe("https://www.geekhunter.com/pt/vagas?searchTerm=desenvolvedor");
    expect(jobs).toHaveLength(4);
    expect(jobs[1]).toMatchObject({
      source: "geekhunter",
      sourceJobId: "ats_19149",
      url: "https://www.geekhunter.com/pt/softlave-desenvolvimento-e-licenciamento-de-programas-de-computador-customizaveis-ltda/jobs/desenvolvedor-mobile-pleno-10",
      title: "Desenvolvedor Mobile Pleno",
      company: "Softlave Desenvolvimento e Licenciamento de Programas de Computador Customizaveis Ltda",
      location: null,
      workModelHint: "Remoto",
      contractHint: "CLT, PJ",
      salaryText: "CLT: R$ 6.000 – 10.000/mês · PJ: R$ 7.000 – 12.000/mês",
    });
    expect(jobs[1].descriptionText).toMatch(/^Senioridade: Pleno\.\nTecnologias: React Native, JavaScript, TypeScript, Machine Learning\.\nSobre a vaga/);
    expect(jobs[1].postedAt?.toISOString()).toBe("2026-10-04T13:10:03.857Z");
    for (const j of jobs) expect(j.url).toMatch(/^https:\/\/www\.geekhunter\.com\/pt\/[a-z0-9-]+\/jobs\/[a-z0-9-]+$/);
    // Cidade só no objeto aninhado; sem faixa salarial informada.
    expect(jobs[0]).toMatchObject({ company: "Mv Saude Digital", location: "Recife, PE", salaryText: null, workModelHint: "Presencial" });
    expect(jobs[2]).toMatchObject({ workModelHint: "Remoto (na cidade)", location: "São Paulo, SP", contractHint: "PJ", salaryText: null });
    expect(jobs[3]).toMatchObject({ company: "Ntt Data", salaryText: "R$ 9.500 – 10.500/mês" });
  });

  it("encodes accents and spaces in the search term", async () => {
    const http = fixtureHttp([[/geekhunter\.com/, sourceFixture("geekhunter-search.html")]]);
    await geekhunterSource.search(q("Desenvolvedor Sênior"), 1, http);
    expect(http.urls[0]).toBe("https://www.geekhunter.com/pt/vagas?searchTerm=Desenvolvedor%20S%C3%AAnior");
  });

  it("returns [] when the search has no jobs", async () => {
    const empty = `<script>self.__next_f.push([1,${JSON.stringify(
      '5:["$","$L5a",null,{"data":[],"meta":{"__typename":"PaginationMeta","total":0,"currentPage":1,"lastPage":0,"perPage":25}}]\n',
    )}])</script>`;
    const http = fixtureHttp([[/geekhunter\.com/, empty]]);
    expect(await geekhunterSource.search(q("xyzzy"), 1, http)).toEqual([]);
    const blank = fixtureHttp([[/geekhunter\.com/, "<html><body></body></html>"]]);
    expect(await geekhunterSource.search(q("xyzzy"), 1, blank)).toEqual([]);
  });

  it("fetchDetail reads the full description from the JobPosting JSON-LD", async () => {
    const url =
      "https://www.geekhunter.com/pt/softlave-desenvolvimento-e-licenciamento-de-programas-de-computador-customizaveis-ltda/jobs/desenvolvedor-mobile-pleno-10";
    const http = fixtureHttp([[/geekhunter\.com/, sourceFixture("geekhunter-detail.html")]]);
    const text = await geekhunterSource.fetchDetail!(url, http);
    expect(http.urls).toEqual([url]);
    expect(text).toMatch(/^Requisitos\n3\+ anos de experiência na carreira\n/);
    expect(text).toContain("Desenvolver e manter aplicativos móveis com React Native;");
    expect(text).not.toMatch(/<[a-z]/);
  });
});

describe("Trampos", () => {
  it("maps the public JSON API used by the page", async () => {
    const http = fixtureHttp([[/trampos\.co\/api\/v2\/opportunities\?/, sourceFixture("trampos-search.json")]]);
    const jobs = await tramposSource.search(q("tecnologia"), 1, http);
    expect(http.urls[0]).toBe("https://trampos.co/api/v2/opportunities?tr=tecnologia&page=1");
    expect(jobs).toHaveLength(4);
    expect(jobs[0]).toMatchObject({
      source: "trampos",
      sourceJobId: "774810",
      url: "https://trampos.co/oportunidades/774810",
      title: "Gestor(a) de Tráfego",
      company: "Fatture Digital",
      location: "São Leopoldo - RS",
      workModelHint: null,
      contractHint: "Emprego",
      salaryText: "R$ 2.000 a R$ 3.000",
      descriptionText: "Área: Marketing.",
    });
    expect(jobs[0].postedAt?.toISOString()).toBe("2026-10-22T14:50:05.000Z"); // 11:50:05 em Brasília
    for (const j of jobs) expect(j.url).toMatch(/^https:\/\/trampos\.co\/oportunidades\/\d+$/);
    expect(jobs[1]).toMatchObject({ company: "B&Partners", location: null, workModelHint: "Home office", salaryText: null }); // "NÃO DIVULGADA"
    expect(jobs[2]).toMatchObject({ company: null, location: "São Paulo - SP", workModelHint: "Híbrido" });
    expect(jobs[3]).toMatchObject({ contractHint: "Freela" });
  });

  it("encodes the term and asks for the requested page", async () => {
    const http = fixtureHttp([[/trampos\.co/, sourceFixture("trampos-search.json")]]);
    await tramposSource.search(q("designer gráfico"), 2, http);
    expect(http.urls[0]).toBe("https://trampos.co/api/v2/opportunities?tr=designer%20gr%C3%A1fico&page=2");
  });

  it("returns [] when the API has no opportunities", async () => {
    const http = fixtureHttp([
      [/trampos\.co/, JSON.stringify({ opportunities: [], pagination: { total: 0, total_pages: 0, per_page: 12 } })],
    ]);
    expect(await tramposSource.search(q("xyzzy"), 1, http)).toEqual([]);
  });

  it("fetchDetail joins description and sections from the detail API", async () => {
    const http = fixtureHttp([[/trampos\.co\/api\/v2\/opportunities\/774832$/, sourceFixture("trampos-detail.json")]]);
    const text = await tramposSource.fetchDetail!("https://trampos.co/oportunidades/774832", http);
    expect(http.urls).toEqual(["https://trampos.co/api/v2/opportunities/774832"]);
    expect(text).toMatch(/^Contratação para Just Solutions/);
    expect(text).toContain("\nRegime: PREST. DE SERVIÇO.\nPré-requisitos:\nExperiência sênior em implementação");
    expect(text).toContain("\nDesejável:\nCertificações Salesforce;");
    expect(text).toContain("\nBenefícios:\n");
    expect(text).toContain("\nOutras informações:\nModelo de contratação: PJ.");
    expect(text).not.toContain("\r");
    expect(await tramposSource.fetchDetail!("https://trampos.co/", http)).toBeNull();
  });
});
