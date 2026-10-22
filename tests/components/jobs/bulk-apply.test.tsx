// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BulkApplyBar } from "@/components/jobs/bulk-apply-bar";

const bar = (over: Partial<Parameters<typeof BulkApplyBar>[0]> = {}) => {
  const props = {
    eligibleCount: 4,
    selectedCount: 0,
    onToggleAll: vi.fn(),
    onApply: vi.fn(),
    onClear: vi.fn(),
    busy: false,
    ...over,
  };
  render(<BulkApplyBar {...props} />);
  return props;
};

describe("BulkApplyBar", () => {
  it("renders nothing without eligible jobs", () => {
    const { container } = render(
      <BulkApplyBar eligibleCount={0} selectedCount={0} onToggleAll={vi.fn()} onApply={vi.fn()} onClear={vi.fn()} busy={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("starts unchecked with the apply button disabled", () => {
    const p = bar();
    const all = screen.getByRole("checkbox", { name: "Selecionar todas (4)" });
    expect(all).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Quero participar (0)" })).toBeDisabled();
    fireEvent.click(all);
    expect(p.onToggleAll).toHaveBeenCalledWith(true);
  });

  it("is indeterminate with a partial selection and applies", () => {
    const p = bar({ selectedCount: 2 });
    expect(screen.getByRole("checkbox", { name: "Selecionar todas (4)" })).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(screen.getByRole("button", { name: "Quero participar (2)" }));
    expect(p.onApply).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(p.onClear).toHaveBeenCalledTimes(1);
  });

  it("is checked when everything is selected and unchecks all", () => {
    const p = bar({ selectedCount: 4 });
    const all = screen.getByRole("checkbox", { name: "Selecionar todas (4)" });
    expect(all).toHaveAttribute("aria-checked", "true");
    fireEvent.click(all);
    expect(p.onToggleAll).toHaveBeenCalledWith(false);
  });

  it("disables apply while busy", () => {
    bar({ selectedCount: 2, busy: true });
    expect(screen.getByRole("button", { name: "Quero participar (2)" })).toBeDisabled();
  });
});
