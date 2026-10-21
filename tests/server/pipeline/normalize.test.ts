import { describe, expect, it } from "vitest";
import {
  canonicalUrl,
  dedupeKey,
  inferContract,
  inferSeniority,
  inferWorkModel,
  normalizeRawJob,
} from "@/server/pipeline/normalize";
import type { RawJob } from "@/server/sources/types";

const raw = (over: Partial<RawJob> = {}): RawJob => ({
  source: "gupy",
  sourceJobId: null,
  url: "https://empresa.gupy.io/job/1",
  title: "Desenvolvedor PHP",
  company: null,
  location: null,
  workModelHint: null,
  contractHint: null,
  salaryText: null,
  postedAt: null,
  descriptionText: null,
  ...over,
});

describe("canonicalUrl", () => {
  it("strips tracking and hash, keeps id params", () => {
    expect(canonicalUrl("https://X.com/job/1?utm_source=a&gclid=b&id=9#top")).toBe("https://x.com/job/1?id=9");
    expect(canonicalUrl("https://br.linkedin.com/jobs/view/a-1?refId=x&trackingId=y&position=1&pageNum=0")).toBe(
      "https://br.linkedin.com/jobs/view/a-1",
    );
  });

  it("returns input untouched when not a URL", () => {
    expect(canonicalUrl("not a url")).toBe("not a url");
  });
});

describe("dedupeKey", () => {
  it("equal across accents, punctuation and company suffix", () => {
    expect(dedupeKey("Fintech Aurora LTDA", "Desenvolvedor Sênior - Laravel")).toBe(
      dedupeKey("fintech aurora", "desenvolvedor senior laravel"),
    );
    expect(dedupeKey("Beta S.A.", "Dev")).toBe(dedupeKey("Beta", "dev"));
  });

  it("falls back to url when company is unknown", () => {
    expect(dedupeKey(null, "Dev PHP", "https://a.com/1")).not.toBe(dedupeKey(null, "Dev PHP", "https://b.com/2"));
    expect(dedupeKey("X", "Dev")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("infer", () => {
  it("infers work model, contract, seniority", () => {
    expect(inferWorkModel("Vaga 100% remoto")).toBe("remote");
    expect(inferWorkModel("on-site")).toBe("onsite");
    expect(inferWorkModel("Modelo híbrido em SP")).toBe("hybrid");
    expect(inferWorkModel("São Paulo")).toBeNull();
    expect(inferContract("Contratação PJ")).toBe("pj");
    expect(inferContract("Regime CLT")).toBe("clt");
    expect(inferSeniority("Dev Sr. PHP")).toBe("senior");
    expect(inferSeniority("Desenvolvedor Pleno")).toBe("pleno");
    expect(inferSeniority("Tech Lead")).toBe("lead");
    expect(inferSeniority("Desenvolvedor")).toBeNull();
  });
});

describe("normalizeRawJob", () => {
  it("tolerates all-null optional fields", () => {
    const job = normalizeRawJob(raw(), 1000);
    expect(job).toMatchObject({
      title: "Desenvolvedor PHP",
      company: null,
      postedAt: null,
      workModel: null,
      contract: null,
      salaryText: null,
      descriptionText: null,
    });
    expect(job.dedupeKey).toMatch(/^[0-9a-f]{16}$/);
  });

  it("uses hints first", () => {
    const job = normalizeRawJob(
      raw({ workModelHint: "on-site", contractHint: "PJ", title: "Dev Sênior", postedAt: new Date(5000), url: "https://a.com/1?utm_medium=x" }),
      1000,
    );
    expect(job).toMatchObject({ workModel: "onsite", contract: "pj", seniority: "senior", postedAt: 5000, url: "https://a.com/1" });
  });

  it("reads seniority from programathor description line", () => {
    expect(normalizeRawJob(raw({ descriptionText: "Senioridade: Pleno.\nTecnologias: PHP." }), 0).seniority).toBe("pleno");
  });
});
