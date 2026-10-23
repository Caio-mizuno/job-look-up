// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteLogin } from "@/components/applications/application-kit";
import { CredentialsManager, type CredentialActions } from "@/components/credentials/credentials-manager";
import { PasswordField } from "@/components/credentials/password-field";
import type { CredentialSummary } from "@/server/credentials/repo";

const gupy: CredentialSummary = {
  id: 3,
  site: "Gupy",
  url: "https://login.gupy.io/candidates/signin",
  username: "ana@exemplo.com",
  notes: null,
  updatedAt: 1,
};

const actions = (over: Partial<CredentialActions> = {}): CredentialActions => ({
  save: vi.fn().mockResolvedValue({ ok: true, id: 1 }),
  remove: vi.fn().mockResolvedValue(undefined),
  reveal: vi.fn().mockResolvedValue({ ok: true, password: "s3gredo" }),
  ...over,
});

const suggestions = [{ label: "Catho", homepage: "https://www.catho.com.br" }];

describe("PasswordField", () => {
  it("keeps the password masked until asked, then hides it again", async () => {
    const reveal = vi.fn().mockResolvedValue({ ok: true, password: "s3gredo" });
    render(<PasswordField id={3} reveal={reveal} />);
    expect(screen.getByTestId("password-3")).toHaveTextContent("••••••••");
    expect(reveal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    await waitFor(() => expect(screen.getByTestId("password-3")).toHaveTextContent("s3gredo"));
    expect(reveal).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(screen.getByTestId("password-3")).toHaveTextContent("••••••••");
  });

  it("copies without showing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<PasswordField id={3} reveal={vi.fn().mockResolvedValue({ ok: true, password: "s3gredo" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar senha" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("s3gredo"));
    expect(screen.getByTestId("password-3")).toHaveTextContent("••••••••");
  });
});

describe("CredentialsManager", () => {
  it("shows the empty state", () => {
    render(<CredentialsManager items={[]} suggestions={suggestions} actions={actions()} />);
    expect(screen.getByText("Nenhuma credencial salva.")).toBeInTheDocument();
  });

  it("adds a credential, filling the address of a known site", async () => {
    const a = actions();
    render(<CredentialsManager items={[]} suggestions={suggestions} actions={a} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "Catho" } });
    expect(screen.getByLabelText("Endereço do login")).toHaveValue("https://www.catho.com.br");
    fireEvent.change(screen.getByLabelText("Login"), { target: { value: "ana@exemplo.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "  com espaço " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(a.save).toHaveBeenCalledWith({
        site: "Catho",
        url: "https://www.catho.com.br",
        username: "ana@exemplo.com",
        password: "  com espaço ",
        notes: "",
      }),
    );
  });

  it("edits without sending the password back and shows validation errors", async () => {
    const a = actions({ save: vi.fn().mockResolvedValue({ ok: false, error: "Informe o login." }) });
    render(<CredentialsManager items={[gupy]} suggestions={suggestions} actions={a} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("placeholder", "Deixe em branco para manter a atual");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(a.save).toHaveBeenCalledWith(expect.objectContaining({ id: 3, password: "", username: "ana@exemplo.com" })));
    expect(await screen.findByText("Informe o login.")).toBeInTheDocument();
  });

  it("deletes only after confirming", async () => {
    const a = actions();
    render(<CredentialsManager items={[gupy]} suggestions={suggestions} actions={a} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(a.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(a.remove).toHaveBeenCalledWith(3));
  });

  it("never renders the password in the list", () => {
    const a = actions();
    render(<CredentialsManager items={[gupy]} suggestions={suggestions} actions={a} />);
    expect(screen.getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(screen.getByTestId("password-3")).toHaveTextContent("••••••••");
    expect(a.reveal).not.toHaveBeenCalled();
  });
});

describe("SiteLogin (kit)", () => {
  it("shows the saved login of the job's site", () => {
    render(<SiteLogin credential={{ id: 3, site: "Gupy", username: "ana@exemplo.com" }} />);
    const section = screen.getByRole("heading", { name: "Login no site (Gupy)" }).parentElement!;
    expect(within(section).getByText("ana@exemplo.com")).toBeInTheDocument();
    expect(within(section).getByTestId("password-3")).toHaveTextContent("••••••••");
  });

  it("links to Credenciais when there is no login", () => {
    render(<SiteLogin credential={null} />);
    expect(screen.getByRole("link", { name: "Salvar em Credenciais" })).toHaveAttribute("href", "/config/credenciais");
  });
});
