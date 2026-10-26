// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudyView } from "@/components/study/study-view";
import type { StudyPlan } from "@/server/study/generate";
import type { TechStats } from "@/server/study/stats";

const state = {
  id: "state",
  label: "Controle de estado",
  jobs: 3,
  priority: "lacuna" as const,
  techs: [
    { name: "Redux", jobs: 2, inProfile: false },
    { name: "Context API", jobs: 1, inProfile: true },
  ],
};
const stats: TechStats = { totalJobs: 10, themes: [state] };

const plan = (concept: string): StudyPlan => ({
  totalJobs: 10,
  updatedAt: 1,
  topics: [
    {
      themeId: "state",
      theme: state,
      summary: "Pedido em 3 vagas.",
      concepts: [concept],
      options: [{ name: "Redux", whenToUse: "Apps grandes com muitas telas." }],
      steps: ["Monte um contador com Zustand."],
      interview: ["Quando Context API basta?"],
      exercise: "Carrinho de compras com Zustand.",
      docs: ["Documentação oficial do Redux"],
    },
  ],
});

const done = (p: StudyPlan) => vi.fn().mockResolvedValue({ status: "done", result: { ok: true, plan: p }, error: null });

describe("StudyView", () => {
  it("shows how much of the listing asks for each technology and what the profile already has", () => {
    render(<StudyView stats={stats} initial={null} generate={vi.fn()} wait={vi.fn()} />);

    expect(screen.getByText("Controle de estado").closest("section")).toHaveTextContent("30% das vagas");
    expect(screen.getByText("Redux").closest("li")).toHaveTextContent("20%");
    expect(screen.getByText("Redux").closest("li")).not.toHaveTextContent("no seu perfil");
    expect(screen.getByText("Context API").closest("li")).toHaveTextContent("no seu perfil");
  });

  it("generates the first study material", async () => {
    const generate = vi.fn().mockResolvedValue({ taskId: 4 });
    const wait = done(plan("Estado global x local"));
    render(<StudyView stats={stats} initial={null} generate={generate} wait={wait} />);

    fireEvent.click(screen.getByRole("button", { name: "Gerar estudo" }));

    expect(await screen.findByText("Estado global x local")).toBeInTheDocument();
    expect(screen.getByText("Apps grandes com muitas telas.")).toBeInTheDocument();
    expect(wait).toHaveBeenCalledWith(4);
  });

  it("asks before replacing the current material, then regenerates", async () => {
    const generate = vi.fn().mockResolvedValue({ taskId: 8 });
    render(<StudyView stats={stats} initial={plan("Conceito antigo")} generate={generate} wait={done(plan("Conceito novo"))} />);

    fireEvent.click(screen.getByRole("button", { name: "Gerar novamente" }));
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Gerar" }));

    await waitFor(() => expect(screen.getByText("Conceito novo")).toBeInTheDocument());
    expect(screen.queryByText("Conceito antigo")).toBeNull();
  });
});
