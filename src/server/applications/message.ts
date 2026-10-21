export type CompanyMessageInput = {
  name: string;
  headline: string;
  skills: string[];
  jobTitle: string;
  company: string | null;
  linkedin: string;
};

const joinPt = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

/**
 * Mensagem genérica e amigável para a empresa/recrutador. Não precisa de IA:
 * fica sempre disponível no Kit e serve de base quando o formulário pede "mensagem" ou "carta".
 */
export function buildCompanyMessage(input: CompanyMessageInput): string {
  const name = input.name.trim();
  const company = input.company?.trim();
  // Headlines costumam vir como "Cargo A | Cargo B": na mensagem fica só o primeiro.
  const role = input.headline.split("|")[0]?.trim() ?? "";
  const skills = joinPt(input.skills.map((s) => s.trim()).filter(Boolean).slice(0, 3));

  const intro = name ? `Meu nome é ${name} e vi a vaga de ${input.jobTitle}.` : `Vi a vaga de ${input.jobTitle}.`;
  const experience = role && skills
    ? `Atuo como ${role}, com experiência em ${skills}.`
    : role
      ? `Atuo como ${role}.`
      : skills
        ? `Tenho experiência com ${skills}.`
        : "";

  const paragraphs = [
    company ? `Olá, pessoal da ${company}! Tudo bem?` : "Olá, tudo bem?",
    [intro, experience, "Me identifiquei com a oportunidade e adoraria participar do processo seletivo."].filter(Boolean).join(" "),
    "Fico à disposição para conversar e enviar mais informações. Agradeço desde já a atenção!",
    ["Abraços,", name, input.linkedin.trim()].filter(Boolean).join("\n"),
  ];
  return paragraphs.join("\n\n");
}
