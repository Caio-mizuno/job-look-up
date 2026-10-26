export const STUDY_COPY = {
  statsTitle: "Tecnologias em alta",
  statsDescription: (total: number) =>
    `Em quantas das ${total} vagas da sua listagem (fontes ligadas, sem descartadas) cada tecnologia aparece.`,
  noJobs: "Nenhuma tecnologia conhecida nas vagas da listagem. Rode uma busca em Vagas encontradas.",
  ofJobs: (pct: string) => `${pct} das vagas`,
  inProfile: "no seu perfil",
  priority: { lacuna: "Lacuna", revisao: "Revisão" },
  planTitle: "Material de estudo",
  planDescription: "A IA monta um roteiro para os temas mais pedidos, com foco no que ainda falta no seu perfil.",
  empty: "Você ainda não tem material. A IA usa as contagens acima e o seu perfil.",
  generate: "Gerar estudo",
  regenerate: "Gerar novamente",
  generating: "Gerando… pode levar alguns minutos",
  generatedAt: (at: number, total: number) => `Gerado em ${new Date(at).toLocaleString("pt-BR")} a partir de ${total} vagas`,
  sections: {
    concepts: "Conceitos-chave",
    options: "Quando usar cada uma",
    steps: "Ordem de estudo",
    interview: "Perguntas de entrevista",
    exercise: "Exercício prático",
    docs: "Documentação oficial",
  },
  confirmTitle: "Gerar um material novo?",
  confirmBody: "A IA conta as vagas de novo e reescreve o material. O atual será substituído.",
  confirm: "Gerar",
  cancel: "Cancelar",
  deferred: "Ajudante desligado: rode make bridge.",
  noTech: "As vagas da listagem não citam nenhuma tecnologia conhecida.",
  failed: (error: string | null) => `A IA falhou: ${error ?? "erro desconhecido"}`,
} as const;

/** "Redux, Zustand, Jotai ou Context API". */
export function orList(names: string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}`;
}

export function percent(jobs: number, total: number): string {
  if (!total) return "0%";
  const p = (jobs / total) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}
