import { describe, expect, it } from "vitest";
import { infojobsSource } from "@/server/sources/infojobs";
import { jobicySource } from "@/server/sources/jobicy";
import { vagascomSource } from "@/server/sources/vagascom";
import { weworkremotelySource } from "@/server/sources/weworkremotely";
import { workingnomadsSource } from "@/server/sources/workingnomads";
import { fixtureHttp, sourceFixture } from "../../helpers/http";

const q = (keywords: string) => ({ keywords, location: null });

describe("We Work Remotely", () => {
  it("reads the programming RSS, splits company and filters by title", async () => {
    const http = fixtureHttp([[/weworkremotely\.com/, sourceFixture("weworkremotely.rss")]]);
    const jobs = await weworkremotelySource.search(q("react"), 1, http);
    expect(http.urls[0]).toBe("https://weworkremotely.com/categories/remote-programming-jobs.rss");
    expect(jobs.map((j) => [j.company, j.title])).toEqual([["Yooli", "FULL TIME: Software Engineer Position - React and Rest"]]);
    expect(jobs[0].url).toMatch(/^https:\/\/weworkremotely\.com\//);
    expect(jobs[0].postedAt).toBeInstanceOf(Date);
    expect(jobs[0].workModelHint).toBe("remote");
    expect(weworkremotelySource.cacheTtlMs).toBe(21_600_000);
  });
});

describe("Working Nomads", () => {
  it("keeps only Development jobs matching the keywords", async () => {
    const http = fixtureHttp([[/workingnomads\.com/, sourceFixture("workingnomads.json")]]);
    const jobs = await workingnomadsSource.search(q("php developer"), 1, http);
    expect(jobs.map((j) => j.title)).toEqual(["Senior Full-stack PHP Developer"]);
    expect(jobs[0]).toMatchObject({ source: "workingnomads", workModelHint: "remote" });
  });
});

describe("Jobicy", () => {
  it("maps fields, salary and credits the source", async () => {
    const http = fixtureHttp([[/jobicy\.com\/api/, sourceFixture("jobicy.json")]]);
    const jobs = await jobicySource.search(q("devops"), 1, http);
    expect(http.urls[0]).toBe("https://jobicy.com/api/v2/remote-jobs?count=50&tag=devops");
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({ title: "IT Systems DevOps Engineer", company: "Cologix, Inc.", location: "USA" });
    expect(jobs[0].salaryText).toBe("US$ 100.000 – 130.000/ano");
    expect(jobs[0].url).toMatch(/^https:\/\/jobicy\.com\/jobs\//);
  });
});

describe("Vagas.com.br", () => {
  it("parses list with company, level and date", async () => {
    const http = fixtureHttp([[/vagas\.com\.br/, sourceFixture("vagascom-search.html")]]);
    const jobs = await vagascomSource.search(q("Desenvolvedor Sênior"), 1, http);
    expect(http.urls[0]).toBe("https://www.vagas.com.br/vagas-de-desenvolvedor-senior");
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({ title: "Desenvolvedor Java Sr", company: "Confidencial" });
    expect(jobs[0].url).toMatch(/^https:\/\/www\.vagas\.com\.br\/vagas\/v\d+/);
    expect(jobs[0].postedAt?.toISOString().slice(0, 10)).toBe("2026-09-24");
    expect(jobs[0].descriptionText).toContain("Senioridade: Sênior");
  });
});

describe("InfoJobs", () => {
  it("parses cards with salary, home office and date", async () => {
    const http = fixtureHttp([[/infojobs\.com\.br/, sourceFixture("infojobs-search.html")]]);
    const jobs = await infojobsSource.search(q("desenvolvedor"), 1, http);
    expect(http.urls[0]).toBe("https://www.infojobs.com.br/empregos.aspx?palabra=desenvolvedor");
    expect(jobs).toHaveLength(3);
    expect(jobs[1]).toMatchObject({
      sourceJobId: "12110291",
      title: "Desenvolvedor(A) Júnior (.NET, React E IA)",
      company: "King of Languages",
      salaryText: "R$ 6.000,00",
      workModelHint: "Home office",
    });
    expect(jobs[0].salaryText).toBeNull(); // "A combinar"
    expect(jobs[2].location).toBe("Brasília - DF");
    expect(jobs[0].url).toBe("https://www.infojobs.com.br/vaga-de-desenvolvedora-delphi-espanhol-avancado-em-__12134455.aspx");
    expect(jobs[0].postedAt?.toISOString()).toBe("2026-10-20T13:29:00.000Z");
  });
});
