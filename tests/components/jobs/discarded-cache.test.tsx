// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscardedCache } from "@/components/jobs/discarded-cache";

describe("DiscardedCache", () => {
  it("renders nothing when there are no discarded jobs", () => {
    const { container } = render(<DiscardedCache count={0} onConfirm={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks before clearing and calls onConfirm once", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DiscardedCache count={3} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Descartadas: 3 · Limpar cache" }));
    expect(await screen.findByText("As 3 vagas voltam para a lista e para as próximas buscas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar cache" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("cancel closes without clearing", async () => {
    const onConfirm = vi.fn();
    render(<DiscardedCache count={3} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Descartadas: 3 · Limpar cache" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByText("Limpar o cache de descartadas?")).not.toBeInTheDocument());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
