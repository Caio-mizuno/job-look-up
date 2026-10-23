import { describe, expect, it } from "vitest";
import { empregosSource } from "@/server/sources/empregos";
import { solidesSource } from "@/server/sources/solides";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const q = (keywords: string) => ({ keywords, location: null });

describe("Empregos.com.br", () => {
  const http = () => fixtureHttp([[/empregos\.com\.br/, sourceFixture("empregos-search.html")]]);

  it("reads jobs from the Nuxt payload", async () => {
    const h = http();
    const jobs = await empregosSource.search(q("desenvolvedor php"), 1, h);
    expect(h.urls).toEqual(["https://www.empregos.com.br/vagas/desenvolvedor-php"]);
    expect(jobs).toHaveLength(4);
    expect(jobs[1]).toMatchObject({
      source: "empregos",
      sourceJobId: "11818174",
      url: "https://www.empregos.com.br/vaga/11818174/desenvolvedor-laravel-com-foco-em-integracao-dados-e-automacao-presencial-em-vitoria-es-com-clt-de-ate-12k-em-vitoria-es",
      title:
        "Desenvolvedor Laravel com foco em Integração, Dados e Automação - Presencial em Vitória ES com CLT de até 12k",
      company: "FourHands Brasil",
      location: "Vitória - ES",
      workModelHint: "Presencial",
      contractHint: null, // "A Combinar"
      salaryText: "R$ 10.000 – 12.000/mês",
    });
    expect(jobs[1].postedAt?.toISOString()).toBe("2026-09-09T19:18:49.523Z");
    expect(jobs[0].postedAt?.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(jobs[0].salaryText).toBeNull(); // R$ 0.00 - R$ 0.00
    expect(jobs[2].salaryText).toBeNull(); // sem faixa
    expect(jobs.map((j) => j.workModelHint)).toEqual(["Remoto", "Presencial", "Presencial", "Híbrido"]);
    for (const j of jobs) {
      expect(j.url).toMatch(/^https:\/\/www\.empregos\.com\.br\/vaga\/\d+(\/[a-z0-9-]+)?$/);
      expect(j.descriptionText?.length).toBeGreaterThan(50);
      expect(j.descriptionText).not.toMatch(/<\/?[a-z]+>/);
    }
  });

  it("falls back to /vaga/<id> when the card link is missing", async () => {
    const jobs = await empregosSource.search(q("desenvolvedor php"), 1, http());
    expect(jobs[3]).toMatchObject({ sourceJobId: "11895390", url: "https://www.empregos.com.br/vaga/11895390" });
  });

  it("slugs accents and adds the page to the path", async () => {
    const h = http();
    await empregosSource.search(q("Desenvolvedor Sênior"), 2, h);
    expect(h.urls[0]).toBe("https://www.empregos.com.br/vagas/desenvolvedor-senior/2");
  });

  it("returns [] when there are no jobs", async () => {
    const empty = `<script type="application/json" id="__NUXT_DATA__">[["ShallowReactive",1],{"data":2},["ShallowReactive",3],{"fetch-jobs":4},{"jobCollection":5},[]]</script>`;
    for (const body of ["<html><body>nada</body></html>", empty]) {
      const h = fixtureHttp([[/empregos\.com\.br/, body]]);
      expect(await empregosSource.search(q("xyz"), 1, h)).toEqual([]);
    }
  });
});

describe("Sólides Vagas", () => {
  const http = () => fixtureHttp([[/vagas\.solides\.com\.br\/api\/vacancies\?/, sourceFixture("solides-search.json")]]);

  it("reads the portal's public vacancies API", async () => {
    const h = http();
    const jobs = await solidesSource.search(q("desenvolvedor"), 1, h);
    expect(h.urls).toEqual(["https://vagas.solides.com.br/api/vacancies?page=1&take=14&title=desenvolvedor"]);
    expect(jobs).toHaveLength(4);
    expect(jobs[2]).toMatchObject({
      source: "solides",
      sourceJobId: "941683",
      url: "https://vagas.solides.com.br/vaga/941683",
      title: "SDR",
      company: "RESOLUTTO LTDA",
      location: "Palhoça - SC",
      workModelHint: "remoto",
      contractHint: "CLT",
      salaryText: "R$ 3.000/mês",
    });
    expect(jobs[2].postedAt?.toISOString()).toBe("2026-10-21T15:00:00.000Z");
    expect(jobs[2].descriptionText).toMatch(/^Senioridade: Junior\.\nEstamos buscando/);
    expect(jobs[0]).toMatchObject({
      title: "Desenvolvedor(a) Full Stack & Mobile | AI-Driven Development",
      workModelHint: "hibrido",
      contractHint: "PJ, CLT",
      salaryText: null, // faixa oculta pela empresa
    });
    expect(jobs[0].postedAt?.toISOString().slice(0, 10)).toBe("2026-10-22");
    expect(jobs[3].salaryText).toBeNull();
    for (const j of [jobs[0], jobs[2], jobs[3]]) expect(j.url).toMatch(/^https:\/\/vagas\.solides\.com\.br\/vaga\/\d+$/);
    for (const j of jobs) expect(j.descriptionText).not.toMatch(/<\/?[a-z]+>/);
  });

  it("links RH Gestor jobs (alphanumeric id) to the external page, like the site's card", async () => {
    const jobs = await solidesSource.search(q("desenvolvedor"), 1, http());
    expect(jobs[1]).toMatchObject({
      sourceJobId: "adndNf9VLX",
      url: "https://logiks.rhgestor.com.br/vagas/detalhes/abxmp90204950FNY1WPG",
      company: "Logiks",
      location: null,
    });
  });

  it("encodes accents and pages", async () => {
    const h = http();
    await solidesSource.search(q("desenvolvedor sênior"), 2, h);
    expect(h.urls[0]).toBe("https://vagas.solides.com.br/api/vacancies?page=2&take=14&title=desenvolvedor+s%C3%AAnior");
  });

  it("formats salary as the portal does", async () => {
    const job = (salary: object) => ({ id: 1, title: "Dev", salary });
    const body = JSON.stringify({
      data: [
        job({ type: "range", showRangeToApplicant: true, initialRange: 3500, finalRange: 4500 }),
        job({ type: "simple", showRangeToApplicant: true, initialRange: 800, finalRange: 800 }),
        job({ type: "range", showRangeToApplicant: true, initialRange: 0, finalRange: 0 }),
        job({ type: "range", showRangeToApplicant: false, initialRange: 3000, finalRange: 5000 }),
      ],
    });
    const jobs = await solidesSource.search(q("dev"), 1, fixtureHttp([[/solides/, body]]));
    expect(jobs.map((j) => j.salaryText)).toEqual(["R$ 3.500 – 4.500/mês", "R$ 800/mês", null, null]);
  });

  it("returns [] when there are no jobs", async () => {
    const h = fixtureHttp([[/solides/, '{"totalPages":0,"currentPage":1,"count":0,"data":[]}']]);
    expect(await solidesSource.search(q("xyz"), 1, h)).toEqual([]);
  });
});
