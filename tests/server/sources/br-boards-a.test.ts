import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bneSource } from "@/server/sources/bne";
import { cathoSource } from "@/server/sources/catho";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const q = (keywords: string, location: string | null = null) => ({ keywords, location });

describe("Catho", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00-03:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses server-rendered cards with company, city, salary and date", async () => {
    const http = fixtureHttp([[/catho\.com\.br\/vagas\//, sourceFixture("catho-search.html")]]);
    const jobs = await cathoSource.search(q("Desenvolvedor PHP"), 1, http);
    expect(http.urls[0]).toBe("https://www.catho.com.br/vagas/desenvolvedor-php/");
    expect(jobs).toHaveLength(4);
    expect(jobs[1]).toMatchObject({
      source: "catho",
      sourceJobId: "38307493",
      url: "https://www.catho.com.br/vagas/desenvolvedora-pleno-php-laravel-vue.js/38307493",
      title: "Desenvolvedor(a) Pleno - PHP / Laravel / Vue.js",
      company: "OKE SOLUÇÃO EM GESTÃO E PESSOAS LTDA",
      location: "Barueri",
      salaryText: "A partir de R$ 5.000,00",
      contractHint: null,
      descriptionText: null,
    });
    expect(jobs.every((j) => /^https:\/\/www\.catho\.com\.br\/vagas\/[^/]+\/\d+$/.test(j.url))).toBe(true);
    expect(jobs[0].location).toBe("Barueri"); // sem o "+ 35 cidades"
    expect(jobs[0].salaryText).toBeNull(); // "A Combinar"
    expect(jobs[2].company).toBeNull(); // "Empresa Confidencial"
    expect(jobs[1].postedAt?.toISOString().slice(0, 10)).toBe("2026-09-08");
    expect(jobs[3].postedAt?.toISOString().slice(0, 10)).toBe("2026-10-22"); // "Atualizada Ontem"
  });

  it("dates without year roll back to last year", async () => {
    vi.setSystemTime(new Date("2027-01-10T12:00:00-03:00"));
    const http = fixtureHttp([[/catho\.com\.br/, sourceFixture("catho-search.html")]]);
    const jobs = await cathoSource.search(q("php"), 1, http);
    expect(jobs[0].postedAt?.toISOString().slice(0, 10)).toBe("2026-08-25");
  });

  it("keeps # and . in the slug and adds the city only with UF", async () => {
    const http = fixtureHttp([[/catho\.com\.br/, "<html><body><ul></ul></body></html>"]]);
    expect(await cathoSource.search(q("Desenvolvedor C#", "Curitiba - PR"), 1, http)).toEqual([]);
    await cathoSource.search(q("Node.js Sênior", "São Paulo"), 1, http);
    expect(http.urls).toEqual([
      "https://www.catho.com.br/vagas/desenvolvedor-c%23/curitiba-pr/",
      "https://www.catho.com.br/vagas/node.js-senior/",
    ]);
  });

  it("fetches the full description from the detail JSON-LD", async () => {
    const http = fixtureHttp([[/\/vagas\/[^/]+\/38307493$/, sourceFixture("catho-detail.html")]]);
    const text = await cathoSource.fetchDetail!("https://www.catho.com.br/vagas/desenvolvedora-pleno-php-laravel-vue.js/38307493", http);
    expect(text).toContain("Desenvolver e manter APIs e aplicações backend em PHP/Laravel");
    expect(text).toContain("Requisitos");
    expect(await cathoSource.fetchDetail!("https://www.catho.com.br/empresas/", http)).toBeNull();
    expect(http.urls).toHaveLength(1);
  });
});

describe("BNE", () => {
  it("reads the jobs JSON from the hidden input", async () => {
    const http = fixtureHttp([[/bne\.com\.br\/vagas-de-emprego\//, sourceFixture("bne-search.html")]]);
    const jobs = await bneSource.search(q("analista de sistemas"), 1, http);
    expect(http.urls[0]).toBe("https://www.bne.com.br/vagas-de-emprego/analista%20de%20sistemas");
    expect(jobs).toHaveLength(4);
    expect(jobs[0]).toMatchObject({
      source: "bne",
      sourceJobId: "6229605",
      url: "https://www.bne.com.br/vaga-de-emprego-na-area-informatica-em-curitiba-pr/analista-de-sistemas/6229605",
      title: "Analista de Sistemas",
      company: "Líder Construção a Seco",
      location: "Curitiba - PR",
      workModelHint: null,
      contractHint: null,
      salaryText: "R$ 4.500,00",
    });
    expect(jobs[0].postedAt?.toISOString()).toBe("2026-10-19T09:41:25.640Z");
    expect(jobs[0].descriptionText).toContain("Atividades: Executar integrações via api");
    expect(jobs.every((j) => /^https:\/\/www\.bne\.com\.br\/vaga-de-emprego-[^/]+\/[^/]+\/\d+$/.test(j.url))).toBe(true);
    // Sem título próprio: cargo do catálogo, com maiúscula.
    expect(jobs[2]).toMatchObject({ title: "Analista comercial", workModelHint: "Home office", salaryText: null });
    expect(jobs[3].company).toBeNull(); // Confidencial
  });

  it("cleans keywords that break the route and returns [] without jobs", async () => {
    const http = fixtureHttp([[/bne\.com\.br/, '<html><body><input type="hidden" id="jobInfoLocal" value="[]" /></body></html>']]);
    expect(await bneSource.search(q("Front-end/Back-end C++"), 1, http)).toEqual([]);
    expect(http.urls[0]).toBe("https://www.bne.com.br/vagas-de-emprego/Front-end%20Back-end%20C");
    const noInput = fixtureHttp([[/bne\.com\.br/, "<html><body></body></html>"]]);
    expect(await bneSource.search(q("php"), 1, noInput)).toEqual([]);
  });

  it("fetches the full description from the detail JSON-LD", async () => {
    const http = fixtureHttp([[/\/6229605$/, sourceFixture("bne-detail.html")]]);
    const text = await bneSource.fetchDetail!(
      "https://www.bne.com.br/vaga-de-emprego-na-area-informatica-em-curitiba-pr/analista-de-sistemas/6229605",
      http,
    );
    expect(text).toContain("Tipo de vínculo: Autônomo.");
    expect(text).not.toContain("<p>");
    expect(await bneSource.fetchDetail!("https://www.bne.com.br/vagas-de-emprego/php", http)).toBeNull();
    expect(http.urls).toHaveLength(1);
  });
});
