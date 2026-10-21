export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const STEPS: { index: StepIndex; label: string; hint: string; required: boolean }[] = [
  { index: 0, label: "Ligar o ajudante", hint: "IA pela sua assinatura", required: false },
  { index: 1, label: "Importar (opcional)", hint: "PDF, .md ou texto", required: false },
  { index: 2, label: "Seus dados", hint: "nome, contato, links", required: true },
  { index: 3, label: "Experiências", hint: "onde trabalhou e o que fez", required: true },
  { index: 4, label: "Habilidades", hint: "tecnologias e nível", required: false },
  { index: 5, label: "Formação e idiomas", hint: "cursos e línguas", required: false },
  { index: 6, label: "O que você procura", hint: "cargo, modelo, salário", required: true },
  { index: 7, label: "Respostas prontas e CV", hint: "perguntas comuns de formulário", required: false },
];

export const LAST_STEP: StepIndex = 7;

export function nextStep(current: number): StepIndex | "done" {
  return current >= LAST_STEP ? "done" : ((current + 1) as StepIndex);
}

export function prevStep(current: number): StepIndex {
  return Math.max(0, current - 1) as StepIndex;
}

export function isStep(value: number): value is StepIndex {
  return Number.isInteger(value) && value >= 0 && value <= LAST_STEP;
}
