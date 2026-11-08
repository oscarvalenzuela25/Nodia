import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PlanReview from "../../../../../modules/teacher/components/PlanReview";
import { planFixture } from "../../fixtures";

describe("Teacher plan assessment policy review", () => {
  it("saves real edited counts through the manual revision callback without asking Teacher or accepting the plan", async () => {
    const onSave = vi.fn(async () => {});
    const onAdjust = vi.fn(async () => {});
    const onAccept = vi.fn(async () => {});
    render(<PlanReview plan={planFixture} busy={false} canAccept onSave={onSave} onAdjust={onAdjust} onAccept={onAccept} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Evaluación" }));
    const field = screen.getByRole("spinbutton", { name: "Práctica de unidad: selección única" });
    expect(field).toHaveValue(3);
    fireEvent.change(field, { target: { value: "4" } });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({ ...planFixture.outline, assessment_policy: { ...planFixture.outline.assessment_policy, practice_counts: { single_choice: 4, completion: 1, short_text: 1 } } });
    expect(onAdjust).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });
  it("preserves an invalid count while busy/refetch changes and blocks save/accept until corrected", async () => {
    const props = { plan: planFixture, canAccept: true, onSave: vi.fn(async () => {}), onAdjust: vi.fn(async () => {}), onAccept: vi.fn(async () => {}) };
    const { rerender } = render(<PlanReview {...props} busy={false} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Evaluación" }));
    const field = screen.getByRole("spinbutton", { name: "Final de sección: respuesta breve" });
    fireEvent.change(field, { target: { value: "" } });
    expect(screen.getByText(/Revisa las cantidades:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    rerender(<PlanReview {...props} busy />);
    expect(field).toBeDisabled();
    rerender(<PlanReview {...props} busy={false} />);
    expect(field).toHaveValue(null);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onAccept).not.toHaveBeenCalled();
  });
});
