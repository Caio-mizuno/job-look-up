import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { netvagasSource, titleFromSlug } from "@/server/sources/netvagas";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const routes = (): [RegExp, string][] => [
  [/sitemap-netvagas\.xml$/, sourceFixture("netvagas-index.xml")],
  [/sitemap-netvagas-vagas-2\.xml$/, sourceFixture("netvagas-vagas-2.xml")],
  [/sitemap-netvagas-vagas-3\.xml$/, sourceFixture("netvagas-vagas-3.xml")],
];

describe("Netvagas", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00-03:00"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads only the two newest job sitemaps and ranks by matched words, then newest", async () => {
    const http = fixtureHttp(routes());
    const jobs = await netvagasSource.search({ keywords: "desenvolvedor backend sênior", location: null }, 1, http);
    expect(http.urls).toEqual([
      "https://www.netvagas.com.br/sitemap-netvagas.xml",
      "https://www.netvagas.com.br/sitemap-netvagas-vagas-3.xml",
      "https://www.netvagas.com.br/sitemap-netvagas-vagas-2.xml",
    ]);
    expect(jobs.map((j) => j.sourceJobId)).toEqual(["2439412", "2439835", "2448147", "2443425"]);
    expect(jobs[0]).toMatchObject({
      source: "netvagas",
      url: "https://www.netvagas.com.br/empresa/anuncios/a2439412/100-remoto-igma-desenvolvedor-a-backend-senior/",
      title: "100 remoto igma desenvolvedor(a) backend senior",
      company: null,
      descriptionText: null,
    });
    expect(jobs[0].postedAt?.toISOString()).toBe("2026-10-12T03:32:03.000Z");
  });

  it("drops jobs older than 30 days", async () => {
    const http = fixtureHttp(routes());
    const jobs = await netvagasSource.search({ keywords: "desenvolvedor net", location: null }, 1, http);
    // a2416652 (".NET pleno RJ", de 24/09) casa as duas palavras, mas passou de 30 dias.
    expect(jobs.map((j) => j.sourceJobId)).not.toContain("2416652");
    expect(jobs[0].sourceJobId).toBe("2443425");
  });

  it("returns empty when nothing matches", async () => {
    const http = fixtureHttp(routes());
    expect(await netvagasSource.search({ keywords: "astronauta", location: null }, 1, http)).toEqual([]);
  });

  it("builds a readable title from the slug", () => {
    expect(titleFromSlug("desenvolvedor-de-software-embarcado-pl")).toBe("Desenvolvedor de software embarcado PL");
    expect(titleFromSlug("2268747-gerente-de-contas-sci-sao-paulo")).toBe("Gerente de contas sci sao paulo");
    expect(titleFromSlug("assistente-de-treinamento-e-desenvolvimento-copia")).toBe("Assistente de treinamento e desenvolvimento");
    expect(titleFromSlug("auxiliar-de-deposito-pcd-cambe")).toBe("Auxiliar de deposito PCD cambe");
  });
});
