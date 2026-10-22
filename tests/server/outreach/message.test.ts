import { describe, expect, it } from "vitest";
import { buildOutreachEmail, withScheme, type OutreachInput } from "@/server/outreach/message";

const input = (over: Partial<OutreachInput> = {}): OutreachInput => ({
  name: "Ana Dev",
  headline: "Desenvolvedora Full Stack | PHP",
  skills: ["PHP", "Laravel", "React", "Vue"],
  phone: "+55 11 90000-0000",
  linkedin: "linkedin.com/in/ana",
  portfolio: "mizunotech.com.br",
  recipientName: "Pessoa Recrutadora A",
  ...over,
});

describe("buildOutreachEmail", () => {
  it("writes the warm message with links", () => {
    const { subject, body } = buildOutreachEmail(input());
    expect(subject).toBe("Ana Dev — Desenvolvedora Full Stack em busca de nova oportunidade");
    expect(body).toBe(
      [
        "Olá, Pessoa! Tudo bem?",
        "",
        "Vi seu post sobre a vaga e quis entrar em contato. Meu nome é Ana Dev, atuo como Desenvolvedora Full Stack, com experiência em PHP, Laravel e React.",
        "",
        "Estou em busca de uma nova oportunidade e adoraria fazer parte do time. Envio meu currículo em anexo e deixo também meus links:",
        "",
        "LinkedIn: https://linkedin.com/in/ana",
        "Portfólio: https://mizunotech.com.br",
        "",
        "Fico à disposição para conversar quando for melhor para você. Agradeço desde já a atenção!",
        "",
        "Abraços,",
        "Ana Dev",
        "+55 11 90000-0000",
      ].join("\n"),
    );
  });

  it("greets without a name when the author is unknown", () => {
    expect(buildOutreachEmail(input({ recipientName: null })).body.startsWith("Olá! Tudo bem?\n\n")).toBe(true);
  });

  it("drops empty link lines and the links sentence when both are empty", () => {
    const onlyLinkedin = buildOutreachEmail(input({ portfolio: "" })).body;
    expect(onlyLinkedin).toContain("LinkedIn: https://linkedin.com/in/ana\n\nFico");
    expect(onlyLinkedin).not.toContain("Portfólio");
    const none = buildOutreachEmail(input({ portfolio: "", linkedin: "" })).body;
    expect(none).toContain("adoraria fazer parte do time. Envio meu currículo em anexo.\n\nFico");
    expect(none).not.toContain("links");
  });

  it("works without a headline", () => {
    const { subject, body } = buildOutreachEmail(input({ headline: "" }));
    expect(subject).toBe("Ana Dev — em busca de nova oportunidade");
    expect(body).toContain("Meu nome é Ana Dev, com experiência em PHP, Laravel e React.");
    expect(body).not.toContain("atuo como");
  });

  it("withScheme adds https only when missing", () => {
    expect(withScheme("mizunotech.com.br")).toBe("https://mizunotech.com.br");
    expect(withScheme("http://x.com")).toBe("http://x.com");
    expect(withScheme("  ")).toBe("");
  });
});
