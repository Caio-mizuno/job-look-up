/** Ajudante desligado: a tarefa deve ser adiada, não contada como falha. */
export class LlmUnavailableError extends Error {}
/** Teto diário de chamadas atingido. */
export class LlmCapReachedError extends Error {}
/** A IA respondeu algo que não bate com o schema. */
export class LlmInvalidOutputError extends Error {
  constructor(public readonly issues: unknown) {
    super("a IA devolveu um JSON fora do formato esperado");
  }
}
