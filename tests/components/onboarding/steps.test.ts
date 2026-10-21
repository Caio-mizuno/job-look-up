import { describe, expect, it } from "vitest";
import { nextStep, prevStep, STEPS } from "@/components/onboarding/steps";

describe("onboarding steps", () => {
  it("STEPS has 8 steps with expected labels", () => {
    expect(STEPS.map((s) => s.label)).toEqual([
      "Ligar o ajudante",
      "Importar (opcional)",
      "Seus dados",
      "Experiências",
      "Habilidades",
      "Formação e idiomas",
      "O que você procura",
      "Respostas prontas e CV",
    ]);
    expect(STEPS.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("navigates forward and back", () => {
    expect(nextStep(0)).toBe(1);
    expect(nextStep(7)).toBe("done");
    expect(prevStep(0)).toBe(0);
    expect(prevStep(3)).toBe(2);
  });
});
