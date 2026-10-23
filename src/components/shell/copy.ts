export const SHELL_COPY = {
  brand: "job-look-up",
  tagline: "Vagas pelo seu perfil",
  groups: { main: "Busca", config: "Configuração" },
  nav: {
    profile: "Meu perfil",
    jobs: "Vagas encontradas",
    applications: "Candidaturas",
    sources: "Fontes de vaga",
    ai: "IA",
    email: "E-mail",
    credentials: "Credenciais",
    bridge: "Ajudante",
  },
  bridge: {
    online: "Ajudante conectado",
    offline: "Ajudante desligado",
  },
  themeToggle: "Alternar tema",
} as const;

export const PAGE_TITLES: Record<string, string> = {
  "/perfil": SHELL_COPY.nav.profile,
  "/vagas": SHELL_COPY.nav.jobs,
  "/candidaturas": SHELL_COPY.nav.applications,
  "/config/fontes": SHELL_COPY.nav.sources,
  "/config/ia": SHELL_COPY.nav.ai,
  "/config/email": SHELL_COPY.nav.email,
  "/config/credenciais": SHELL_COPY.nav.credentials,
  "/config/ajudante": SHELL_COPY.nav.bridge,
};
