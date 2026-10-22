export type OutreachInput = {
  name: string;
  headline: string;
  skills: string[];
  phone: string;
  linkedin: string;
  portfolio: string;
  /** Quem publicou o post; o e-mail cumprimenta pelo primeiro nome. */
  recipientName: string | null;
};

const joinPt = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

/** Link digitado sem protocolo no perfil ("mizunotech.com.br") vira clicável no e-mail. */
export function withScheme(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/**
 * E-mail caloroso para quem postou a vaga: quem é a pessoa, que está buscando oportunidade, CV em anexo e links.
 * Sem IA: sempre disponível e previsível; a pessoa edita no diálogo antes de enviar.
 */
export function buildOutreachEmail(input: OutreachInput): { subject: string; body: string } {
  const name = input.name.trim();
  const role = input.headline.split("|")[0]?.trim() ?? "";
  const skills = joinPt(input.skills.map((s) => s.trim()).filter(Boolean).slice(0, 3));
  const first = input.recipientName?.trim().split(/\s+/)[0];
  const links = [
    input.linkedin.trim() && `LinkedIn: ${withScheme(input.linkedin)}`,
    input.portfolio.trim() && `Portfólio: ${withScheme(input.portfolio)}`,
  ].filter(Boolean);

  const about = [name && `Meu nome é ${name}`, role && `atuo como ${role}`, skills && `com experiência em ${skills}`]
    .filter(Boolean)
    .join(", ");
  const intro = ["Vi seu post sobre a vaga e quis entrar em contato.", about && `${about.charAt(0).toUpperCase()}${about.slice(1)}.`]
    .filter(Boolean)
    .join(" ");
  const pitch = links.length
    ? "Estou em busca de uma nova oportunidade e adoraria fazer parte do time. Envio meu currículo em anexo e deixo também meus links:"
    : "Estou em busca de uma nova oportunidade e adoraria fazer parte do time. Envio meu currículo em anexo.";

  const paragraphs = [
    first ? `Olá, ${first}! Tudo bem?` : "Olá! Tudo bem?",
    intro,
    pitch,
    ...(links.length ? [links.join("\n")] : []),
    "Fico à disposição para conversar quando for melhor para você. Agradeço desde já a atenção!",
    ["Abraços,", name, input.phone.trim()].filter(Boolean).join("\n"),
  ];
  const subject = role ? `${name} — ${role} em busca de nova oportunidade` : `${name} — em busca de nova oportunidade`;
  return { subject, body: paragraphs.join("\n\n") };
}
