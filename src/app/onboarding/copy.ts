export const ONBOARDING_COPY = {
  brand: "job-look-up",
  progress: (n: number, total: number) => `Etapa ${n} de ${total}`,
  saving: "salvando…",
  saved: "salvo automaticamente",
  saveError: "não consegui salvar",
  back: "Voltar",
  skip: "Pular por agora",
  next: "Continuar",
  finish: "Concluir e buscar vagas",
  finishMissing: "Para buscar, faltam:",
  missing: {
    name: "nome",
    email: "e-mail",
    experienceOrSkill: "uma experiência ou habilidade",
    preferences: "cargo e modelo de trabalho que você procura",
  },
  import: {
    title: "Importar currículo",
    description:
      "Adianta o preenchimento: a IA lê seu currículo e preenche as próximas etapas. Você revisa tudo antes de buscar.",
    linkedinTip:
      "Dica: no LinkedIn, abra seu perfil → Mais → Salvar como PDF, e envie esse PDF aqui.",
    file: "Arquivo (PDF, .md ou .txt, até 5 MB)",
    or: "ou cole o texto",
    textPlaceholder: "Cole aqui seu currículo, seu perfil do LinkedIn ou tudo o que você sabe fazer.",
    useAsCv: "Usar este PDF também como currículo nos formulários",
    run: "Importar com IA",
    running: "Lendo seu currículo… pode levar até 1 minuto",
    needsBridge: "Ligue o ajudante (etapa anterior) para importar com IA, ou pule e preencha à mão.",
  },
} as const;
