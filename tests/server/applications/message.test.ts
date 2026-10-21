import { describe, expect, it } from "vitest";
import { buildCompanyMessage } from "@/server/applications/message";
import { DraftsSchema } from "@/server/applications/schema";

describe("buildCompanyMessage", () => {
  it("is friendly and mentions name, job and company", () => {
    const msg = buildCompanyMessage({
      name: "Caio Mizuno",
      headline: "Desenvolvedor Full Stack",
      skills: ["Laravel", "Next.js", "PostgreSQL", "Docker"],
      jobTitle: "Desenvolvedor PHP Sênior",
      company: "Empresa X",
      linkedin: "https://www.linkedin.com/in/caio-mizuno/",
    });
    expect(msg).toMatch(/^Olá, pessoal da Empresa X!/);
    expect(msg).toContain("Meu nome é Caio Mizuno");
    expect(msg).toContain("Desenvolvedor PHP Sênior");
    expect(msg).toContain("Laravel, Next.js e PostgreSQL");
    expect(msg).toContain("https://www.linkedin.com/in/caio-mizuno/");
    expect(msg.trim().split("\n").pop()).toBe("https://www.linkedin.com/in/caio-mizuno/");
  });

  it("degrades gracefully without company, headline, skills or links", () => {
    const msg = buildCompanyMessage({ name: "", headline: "", skills: [], jobTitle: "Dev", company: null, linkedin: "" });
    expect(msg).toMatch(/^Olá, tudo bem\?/);
    expect(msg).not.toMatch(/undefined|null| {2}|\.\./);
    expect(msg).not.toContain("Meu nome é ");
    expect(msg).toContain("vaga de Dev");
  });
});

describe("DraftsSchema", () => {
  it("includes a message to the company", () => {
    expect(DraftsSchema.safeParse({ pitch: "p", whyCompany: "w" }).success).toBe(false);
    expect(DraftsSchema.safeParse({ pitch: "p", whyCompany: "w", message: "Olá!" }).success).toBe(true);
  });
});
