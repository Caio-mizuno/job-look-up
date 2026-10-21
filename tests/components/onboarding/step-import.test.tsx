// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepImport } from "@/components/onboarding/step-import";
import { emptyProfile, type Profile } from "@/server/profile/schema";
import type { LastImport } from "@/server/settings";

const m = vi.hoisted(() => ({
  startImport: vi.fn(),
  loadProfile: vi.fn(),
  recordImport: vi.fn(),
  uploadCv: vi.fn(),
  waitTask: vi.fn(),
  bridgeOnline: true,
}));

vi.mock("@/app/onboarding/actions", () => ({
  startImport: m.startImport,
  loadProfile: m.loadProfile,
  recordImport: m.recordImport,
  uploadCv: m.uploadCv,
}));
vi.mock("@/lib/wait-task", () => ({ waitTask: m.waitTask }));
vi.mock("@/lib/use-app-status", () => ({ useAppStatus: () => ({ bridgeOnline: m.bridgeOnline }) }));

const imported = (over: Partial<Profile> = {}): Profile => {
  const p = emptyProfile();
  return {
    ...p,
    personal: { ...p.personal, name: "Caio" },
    experiences: [{ title: "Dev", company: "X", start: "2020-01", end: null, workModel: null, description: "", technologies: [] }],
    skills: [{ name: "React" } as Profile["skills"][number]],
    ...over,
  };
};

function Harness({ lastImport = null, onReview = vi.fn() }: { lastImport?: LastImport | null; onReview?: () => void }) {
  const [profile, setProfile] = useState(lastImport ? imported() : emptyProfile());
  return <StepImport profile={profile} onChange={setProfile} needsBridge lastImport={lastImport} onReview={onReview} />;
}

const pick = (container: HTMLElement, file: File) =>
  fireEvent.change(container.querySelector("#import-file")!, { target: { files: [file] } });

const pdf = () => new File(["%PDF-1.4"], "Profile.pdf", { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  m.bridgeOnline = true;
  m.startImport.mockResolvedValue({ taskId: 1 });
  m.waitTask.mockResolvedValue({ status: "done", result: { ok: true }, error: null });
  m.loadProfile.mockResolvedValueOnce(imported()).mockResolvedValue(imported({ cvPath: "/app/data/cv/cv.pdf" }));
  m.uploadCv.mockResolvedValue({ ok: true });
  m.recordImport.mockImplementation(async (source: string) => ({ source, at: 1 }));
});

describe("StepImport", () => {
  it("starts the AI as soon as a file is picked, shows progress, then what was filled", async () => {
    let finish!: (v: unknown) => void;
    m.waitTask.mockReturnValueOnce(new Promise((r) => (finish = r)));
    const onReview = vi.fn();
    const { container } = render(<Harness onReview={onReview} />);

    pick(container, pdf());

    expect(await screen.findByText("Recebido: Profile.pdf")).toBeInTheDocument();
    expect(screen.getByText("A IA está lendo e preenchendo seu perfil")).toBeInTheDocument();
    expect(m.startImport).toHaveBeenCalledTimes(1);
    expect((m.startImport.mock.calls[0][0] as FormData).get("file")).toBeInstanceOf(File);
    expect(container.querySelector("#import-file")).toBeNull();

    finish({ status: "done", result: { ok: true }, error: null });

    expect(await screen.findByText("Importado de Profile.pdf")).toBeInTheDocument();
    expect(screen.getByText("Perfil preenchido: nome e contato · 1 experiência · 1 habilidade")).toBeInTheDocument();
    expect(screen.getByText("PDF salvo como seu currículo nos formulários")).toBeInTheDocument();
    expect(m.uploadCv).toHaveBeenCalledTimes(1);
    expect(m.recordImport).toHaveBeenCalledWith("Profile.pdf");

    fireEvent.click(screen.getByRole("button", { name: /Revisar dados/ }));
    expect(onReview).toHaveBeenCalled();
  });

  it("does not keep the PDF as CV when the box is unchecked", async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox"));
    pick(container, pdf());
    expect(await screen.findByText("Importado de Profile.pdf")).toBeInTheDocument();
    expect(m.uploadCv).not.toHaveBeenCalled();
    expect(screen.queryByText("PDF salvo como seu currículo nos formulários")).toBeNull();
  });

  it("refuses unsupported or too large files without calling the AI", async () => {
    const { container } = render(<Harness />);
    pick(container, new File(["x"], "foto.png", { type: "image/png" }));
    expect(await screen.findByText("Não deu para importar foto.png")).toBeInTheDocument();
    expect(screen.getByText(/Formato não suportado/)).toBeInTheDocument();

    const big = new File(["x"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    pick(container, big);
    expect(await screen.findByText(/maior que 5 MB/)).toBeInTheDocument();
    expect(m.startImport).not.toHaveBeenCalled();
  });

  it("shows the AI error inline and retries the same file", async () => {
    m.startImport.mockResolvedValueOnce({ error: "no_text" });
    const { container } = render(<Harness />);
    pick(container, pdf());
    expect(await screen.findByText(/Não encontrei texto/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(await screen.findByText("Importado de Profile.pdf")).toBeInTheDocument();
    expect(m.startImport).toHaveBeenCalledTimes(2);
  });

  it("imports pasted text with the button", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText(/Cole aqui/), { target: { value: "Dev React há 5 anos" } });
    fireEvent.click(screen.getByRole("button", { name: /Importar texto com IA/ }));
    expect(await screen.findByText("Importado de texto colado")).toBeInTheDocument();
    expect((m.startImport.mock.calls[0][0] as FormData).get("text")).toBe("Dev React há 5 anos");
  });

  it("remembers a previous import and lets you import another file", () => {
    const { container } = render(<Harness lastImport={{ source: "Profile.pdf", at: 1 }} />);
    expect(screen.getByText("Importado de Profile.pdf")).toBeInTheDocument();
    expect(container.querySelector("#import-file")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Importar outro arquivo/ }));
    expect(container.querySelector("#import-file")).not.toBeNull();
  });

  it("blocks the drop zone while the helper is off", async () => {
    m.bridgeOnline = false;
    const { container } = render(<Harness />);
    await waitFor(() => expect(container.querySelector("#import-file")).toBeDisabled());
    expect(screen.getByText(/Ligue o ajudante/)).toBeInTheDocument();
  });
});
