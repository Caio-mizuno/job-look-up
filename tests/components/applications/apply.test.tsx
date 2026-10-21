// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationRow } from "@/components/applications/application-row";
import { ApplyButton } from "@/components/applications/apply-button";
import { CopyField } from "@/components/applications/application-kit";
import { UnansweredForm } from "@/components/applications/unanswered-form";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ApplicationListItem } from "@/server/applications/list";

describe("ApplyButton", () => {
  it("shows 'Abrir Kit' for linkedin", () => {
    const onKit = vi.fn();
    render(
      <TooltipProvider>
        <ApplyButton url="https://br.linkedin.com/jobs/view/1" application={null} onApply={vi.fn()} onOpenKit={onKit} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Abrir Kit/ }));
    expect(onKit).toHaveBeenCalled();
  });

  it("label follows application status", () => {
    const cases: [string | null, RegExp][] = [
      [null, /Quero participar/],
      ["queued", /Na fila do ajudante/],
      ["running", /Preenchendo no Chrome/],
      ["needs_review", /Pronta pra revisar no Chrome/],
      ["login_required", /Faça login no Chrome e tente de novo/],
      ["failed", /Falhou · Tentar de novo/],
      ["submitted", /Enviada ✓/],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(
        <ApplyButton
          url="https://x.gupy.io/job/1"
          application={status ? { id: 1, status: status as never } : null}
          onApply={vi.fn()}
          onOpenKit={vi.fn()}
        />,
      );
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
      unmount();
    }
  });
});

const app = (over: Partial<ApplicationListItem> = {}): ApplicationListItem => ({
  id: 7,
  status: "needs_review",
  error: null,
  createdAt: 0,
  finishedAt: 0,
  events: [],
  extraAnswers: [],
  report: { status: "needs_review", filled: ["Nome: Caio"], drafted: ["Por que aqui?"], unanswered: ["Pretensão salarial?"], notes: "ok" },
  job: { id: 1, title: "Dev", company: "X", url: "https://x.gupy.io/job/1", source: "gupy" },
  ...over,
});

describe("ApplicationRow", () => {
  it("lists filled, drafted and unanswered", () => {
    render(<ApplicationRow application={app()} onSubmitted={vi.fn()} onRetry={vi.fn()} onCancel={vi.fn()} onAnswer={vi.fn()} />);
    expect(screen.getByText("Nome: Caio")).toBeInTheDocument();
    expect(screen.getByText("Por que aqui?")).toBeInTheDocument();
    expect(screen.getByText("Rascunho da IA (revise)")).toBeInTheDocument();
    expect(screen.getAllByText("Pretensão salarial?").length).toBeGreaterThan(0);
  });
});

describe("UnansweredForm", () => {
  it("submits answers with saveAsReady", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<UnansweredForm questions={["Pretensão salarial?"]} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Pretensão salarial?"), { target: { value: "R$ 15.000" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Salvar como resposta pronta/ }));
    fireEvent.click(screen.getByRole("button", { name: /Responder e tentar de novo/ }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith([{ question: "Pretensão salarial?", answer: "R$ 15.000", saveAsReady: true }]),
    );
  });
});

describe("Kit message", () => {
  it("renders the company message with a copy button", async () => {
    const { CompanyMessage } = await import("@/components/applications/application-kit");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CompanyMessage message="Olá, pessoal da X!" />);
    expect(screen.getByText("Mensagem para a empresa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copiar Mensagem para a empresa/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Olá, pessoal da X!"));
  });
});

describe("Kit", () => {
  it("copy button writes to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyField label="E-mail" value="caio@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: /Copiar E-mail/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("caio@example.com"));
  });
});
