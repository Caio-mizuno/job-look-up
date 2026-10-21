// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobCard } from "@/components/jobs/job-card";
import type { JobListItem } from "@/server/jobs/list";

const item = (over: Partial<JobListItem> = {}): JobListItem => ({
  id: 1,
  title: "Desenvolvedor Laravel",
  company: null,
  location: null,
  workModel: null,
  contract: null,
  seniority: null,
  salaryText: null,
  postedAt: null,
  source: "gupy",
  sourceLabel: "Gupy",
  sourceHomepage: "https://portal.gupy.io",
  url: "https://empresa.gupy.io/job/1",
  status: "new",
  isNew: false,
  analysis: "pending",
  enrichment: null,
  application: null,
  ...over,
});

const enrichment = {
  matchScore: 92,
  why: "Pede Laravel <script>alert(1)</script>",
  gaps: ["AWS"],
  summary: "Squad de pagamentos.",
  offers: ["100% remoto"],
  responsibilities: ["Manter APIs"],
  requirements: [
    { text: "Laravel 4+ anos", mustHave: true },
    { text: "AWS", mustHave: false },
  ],
  workModel: null,
  contract: null,
  salary: null,
  stale: false,
};

const handlers = { onOpen: vi.fn(), onDiscard: vi.fn(), onRecalc: vi.fn() };

describe("JobCard", () => {
  it("renders fallbacks for null company/salary", () => {
    render(<JobCard job={item()} bridgeOnline compact={false} {...handlers} />);
    expect(screen.getByText("Empresa não informada")).toBeInTheDocument();
    expect(screen.getByText("Salário não informado")).toBeInTheDocument();
    expect(screen.getByText("analisando…")).toBeInTheDocument();
  });

  it("renders scraped/AI text as literal text", () => {
    const { container } = render(
      <JobCard job={item({ analysis: "done", enrichment })} bridgeOnline compact={false} {...handlers} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/Pede Laravel <script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("O que oferece")).toBeInTheDocument();
    expect(screen.getByText(/Diferencial: AWS/)).toBeInTheDocument();
  });

  it("does not repeat equal meta entries", () => {
    render(<JobCard job={item({ location: "Remoto", workModel: "remote" })} bridgeOnline compact={false} {...handlers} />);
    expect(screen.getAllByText("Remoto")).toHaveLength(1);
  });

  it("omits href for javascript: url", () => {
    render(<JobCard job={item({ url: "javascript:alert(1)" })} bridgeOnline compact={false} {...handlers} />);
    expect(screen.queryByRole("link", { name: /Abrir vaga/ })).toBeNull();
  });

  it("shows 'análise falhou' with retry when failed", () => {
    render(<JobCard job={item({ analysis: "failed" })} bridgeOnline compact={false} {...handlers} />);
    expect(screen.getByText(/análise falhou/)).toBeInTheDocument();
    screen.getByRole("button", { name: /Tentar de novo/ }).click();
    expect(handlers.onRecalc).toHaveBeenCalledWith(1);
  });

  it("offers 'Analisar' when the job was never queued", () => {
    render(<JobCard job={item({ analysis: "none" })} bridgeOnline compact={false} {...handlers} />);
    expect(screen.getByText("sem análise")).toBeInTheDocument();
    screen.getByRole("button", { name: /Analisar/ }).click();
    expect(handlers.onRecalc).toHaveBeenCalledWith(1);
  });

  it("says 'aguardando análise' when bridge is offline", () => {
    render(<JobCard job={item()} bridgeOnline={false} compact={false} {...handlers} />);
    expect(screen.getByText("aguardando análise")).toBeInTheDocument();
  });

  it("shows stale badge and recalc", () => {
    render(<JobCard job={item({ analysis: "done", enrichment: { ...enrichment, stale: true } })} bridgeOnline compact={false} {...handlers} />);
    expect(screen.getByText("perfil mudou")).toBeInTheDocument();
  });
});
