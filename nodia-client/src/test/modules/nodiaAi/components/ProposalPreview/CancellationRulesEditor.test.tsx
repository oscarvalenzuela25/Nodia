import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import CancellationRulesEditor from "../../../../../modules/nodiaAi/components/ProposalPreview/CancellationRulesEditor";
import type { NodiaAiCancellationRuleDraft } from "../../../../../modules/nodiaAi/infrastructure/cancellationRulesReview";

function Controlled() {
  const [value, setValue] = useState<NodiaAiCancellationRuleDraft[]>([
    { row_id: "zero", min_days_before: "0", refund_percent: "0.00" }, { row_id: "seven", min_days_before: "7", refund_percent: "50.00" },
  ]);
  return <CancellationRulesEditor label="Synthetic rules" value={value} onChange={setValue} disabled={false} error={false} />;
}
describe("registered cancellation rules editor", () => {
  it("preserves the same input after an earlier row is removed", () => {
    render(<Controlled />);
    const original = screen.getAllByRole("textbox", { name: /^Porcentaje/ })[1];
    fireEvent.change(original, { target: { value: "80.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Quitar regla 1" }));
    expect(screen.getByRole("textbox", { name: /^Porcentaje/ })).toBe(original);
    expect(original).toHaveValue("80.25");
    expect(screen.getByRole("button", { name: "Quitar regla 1" })).toBeDisabled();
  });
  it("disables every control during a request, including row addition and removal", () => {
    const change = vi.fn();
    render(<CancellationRulesEditor label="Synthetic rules" value={[{ row_id: "zero", min_days_before: "0", refund_percent: "0.00" }]} onChange={change} disabled error={false} />);
    for (const input of screen.getAllByRole("textbox")) expect(input).toBeDisabled();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(change).not.toHaveBeenCalled();
  });
  it("stops adding rows at the native maximum", () => {
    render(<CancellationRulesEditor label="Synthetic rules" value={Array.from({ length: 100 }, (_, index) => ({ row_id: String(index), min_days_before: String(index), refund_percent: "0" }))} onChange={vi.fn()} disabled={false} error={false} />);
    expect(screen.getByRole("button", { name: "Agregar regla" })).toBeDisabled();
  });
});
