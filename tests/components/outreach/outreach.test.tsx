// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailButton } from "@/components/outreach/email-button";
import { OutreachDialog } from "@/components/outreach/outreach-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

const draft = { to: "vagas@exemplo.com.br", subject: "Ana Dev — em busca de nova oportunidade", body: "Olá, Pessoa! Tudo bem?" };
const loaded = (over: Partial<{ cvFilename: string | null; configured: boolean; sentAt: number | null }> = {}) =>
  vi.fn().mockResolvedValue({ draft, cvFilename: "Ana_CV.pdf", sentAt: null, configured: true, ...over });

describe("EmailButton", () => {
  it("opens the dialog when the post has an e-mail", () => {
    const onOpen = vi.fn();
    render(<EmailButton contactEmail="rh@x.com" sentAt={null} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar e-mail" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("is disabled with a hint when the post has no e-mail", async () => {
    render(
      <TooltipProvider>
        <EmailButton contactEmail={null} sentAt={null} onOpen={vi.fn()} />
      </TooltipProvider>,
    );
    const button = screen.getByRole("button", { name: "Enviar e-mail" });
    expect(button).toBeDisabled();
    fireEvent.focus(button.parentElement!);
    expect(await screen.findAllByText("Esse post não tem e-mail. Abra o post e fale pelo LinkedIn.")).not.toHaveLength(0);
  });

  it("shows sent state", () => {
    render(<EmailButton contactEmail="rh@x.com" sentAt={1} onOpen={vi.fn()} />);
    expect(screen.getByRole("button", { name: "E-mail enviado ✓" })).toBeDisabled();
  });
});

describe("OutreachDialog", () => {
  it("sends the edited draft", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true });
    const onSent = vi.fn();
    render(<OutreachDialog jobId={7} open onOpenChange={vi.fn()} load={loaded()} send={send} onSent={onSent} />);

    const body = await screen.findByLabelText("Mensagem");
    expect(screen.getByLabelText("Para")).toHaveValue("vagas@exemplo.com.br");
    expect(screen.getByText("Anexo: Ana_CV.pdf")).toBeInTheDocument();
    fireEvent.change(body, { target: { value: "Texto novo" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(send).toHaveBeenCalledWith(7, { ...draft, body: "Texto novo" }));
    await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1));
  });

  it("blocks sending when e-mail is not configured", async () => {
    render(<OutreachDialog jobId={7} open onOpenChange={vi.fn()} load={loaded({ configured: false })} send={vi.fn()} onSent={vi.fn()} />);
    expect(await screen.findByText("E-mail não configurado: veja Configuração → E-mail.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configuração → E-mail/ })).toHaveAttribute("href", "/config/email");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("blocks sending without a CV", async () => {
    render(<OutreachDialog jobId={7} open onOpenChange={vi.fn()} load={loaded({ cvFilename: null })} send={vi.fn()} onSent={vi.fn()} />);
    expect(await screen.findByText("Sem currículo no perfil: envie o PDF em Perfil.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Perfil/ })).toHaveAttribute("href", "/perfil");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("shows the server message on smtp failure", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: "smtp", message: "O Gmail recusou o login: use uma senha de app." });
    const onSent = vi.fn();
    render(<OutreachDialog jobId={7} open onOpenChange={vi.fn()} load={loaded()} send={send} onSent={onSent} />);
    fireEvent.click(await screen.findByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("O Gmail recusou o login: use uma senha de app.")).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
  });
});
