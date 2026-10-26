// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoverLetterEditor } from "@/components/cover-letter/cover-letter-editor";

const done = (text: string) => vi.fn().mockResolvedValue({ status: "done", result: { ok: true, text }, error: null });

describe("CoverLetterEditor", () => {
  it("generates the first letter when there is none yet", async () => {
    const generate = vi.fn().mockResolvedValue({ taskId: 5 });
    const wait = done("Prezado(a) recrutador(a), sou o Caio.");
    render(<CoverLetterEditor initial={null} generate={generate} wait={wait} save={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Gerar carta" }));

    expect(await screen.findByLabelText("Carta de apresentação")).toHaveValue("Prezado(a) recrutador(a), sou o Caio.");
    expect(wait).toHaveBeenCalledWith(5);
  });

  it("asks before replacing the current letter, then regenerates", async () => {
    const generate = vi.fn().mockResolvedValue({ taskId: 9 });
    render(
      <CoverLetterEditor initial={{ text: "Carta antiga", updatedAt: 1 }} generate={generate} wait={done("Carta nova")} save={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gerar novamente" }));
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Gerar" }));

    await waitFor(() => expect(screen.getByLabelText("Carta de apresentação")).toHaveValue("Carta nova"));
  });

  it("saves the edited letter", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    render(<CoverLetterEditor initial={{ text: "Carta", updatedAt: 1 }} generate={vi.fn()} wait={vi.fn()} save={save} />);

    fireEvent.change(screen.getByLabelText("Carta de apresentação"), { target: { value: "Carta editada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith("Carta editada"));
  });
});
