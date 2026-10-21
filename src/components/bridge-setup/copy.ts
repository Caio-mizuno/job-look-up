export const BRIDGE_COPY = {
  title: "Ajudante do Chrome",
  description:
    "Um pequeno programa que roda no seu computador, fora do Docker. Ele usa o seu Claude Code para analisar vagas e o Claude in Chrome para preencher candidaturas.",
  commandLabel: "No terminal, na pasta do projeto:",
  command: "make bridge",
  requirementsTitle: "Precisa de",
  requirements: [
    "Claude Code instalado e logado (a análise usa a sua assinatura, sem custo extra)",
    "Google Chrome aberto com a extensão Claude in Chrome ativa",
    "Node 20.12 ou mais novo",
  ],
  privacyTitle: "O que sai da sua máquina",
  privacy:
    "Enquanto o ajudante trabalha, seu perfil, seu currículo e o texto das vagas vão para a Anthropic pelo Claude Code. Isso vale para a análise das vagas (no modo padrão) e sempre para a candidatura, mesmo se você usar Ollama na análise. O resto fica só no seu computador.",
  accept: "Entendi",
  accepted: "Aviso confirmado",
  alternative: "Prefere usar chave de API ou Ollama na análise?",
  alternativeLink: "Configurar IA",
} as const;
