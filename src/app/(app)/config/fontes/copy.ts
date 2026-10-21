export const SOURCES_COPY = {
  title: "Fontes de vaga",
  description: "Onde o app procura. Poucas requisições por busca, com cache, sem login e sem contornar bloqueios.",
  status: { idle: "ainda não usada", ok: "ok", limited: "limitada", error: "erro" },
  lastRun: (count: number) => `${count} vagas na última busca`,
  warnings: {
    linkedin: "Pode ser bloqueada pelo LinkedIn. Nunca usa seu login.",
    indeed: "O site barra acesso direto: o ajudante abre a busca num Chrome separado do seu (sem seu login). Pode ser bloqueada pelo Indeed.",
    glassdoor: "O site barra acesso direto: o ajudante abre a busca num Chrome separado do seu (sem seu login). Traz só o resumo de cada vaga.",
    arbeitnow: "Foco em vagas da Europa.",
    remotive: "Vagas com 24 h de atraso; o app consulta no máximo 4 vezes por dia, como pedem os termos.",
  } as Record<string, string>,
} as const;
