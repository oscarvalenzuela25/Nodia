import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReinforcementPanel from "../../../../../modules/teacher/components/ReinforcementPanel";
import type { Reinforcement } from "../../../../../modules/teacher/infrastructure/schemas";

const projection: Reinforcement = { plan_revision_id: "plan", section_id: "section", navigation: "current_plan", objectives: [{ objective_id: "records", description: "Reconocer tipos de registros", earned_points: 0, possible_points: 4, units: [{ unit_id: "unit2", title: "Registros DNS" }, { unit_id: "unit3", title: "Aplicación" }] }] };
describe("Teacher focal reinforcement controls", () => {
  it("offers only authoritative units and preserves control identity/focus through a recoverable error", () => {
    const onOpen = vi.fn(); const onChooseUnit = vi.fn(); const props = { projection, currentPlanId: "plan", busy: false, failed: false, onOpen, onChooseUnit };
    const { rerender } = render(<ReinforcementPanel {...props} />);
    expect(screen.getByText("0 de 4 puntos; 4 puntos por recuperar.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Estudiar: Registros DNS" }); button.focus(); fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith("unit2"); expect(onChooseUnit).not.toHaveBeenCalled();
    rerender(<ReinforcementPanel {...props} busy />); expect(button).toBeDisabled();
    rerender(<ReinforcementPanel {...props} failed />);
    expect(screen.getByRole("button", { name: "Estudiar: Registros DNS" })).toBe(button); expect(button).toHaveFocus(); expect(button).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Tu resultado sigue disponible");
  });
  it("keeps historical or no-longer-current targets descriptive without routing their unit ids", () => {
    const onOpen = vi.fn(); const props = { projection, currentPlanId: "new-plan", busy: false, failed: false, onOpen, onChooseUnit: vi.fn() };
    render(<ReinforcementPanel {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("versión anterior");
    expect(screen.queryByRole("button", { name: "Estudiar: Registros DNS" })).not.toBeInTheDocument();
    expect(screen.getByText("Registros DNS")).toBeInTheDocument(); expect(onOpen).not.toHaveBeenCalled();
  });
  it("truthfully offers the plan outline when focal data is absent instead of reusing the last unit", () => {
    const onChooseUnit = vi.fn(); render(<ReinforcementPanel projection={null} currentPlanId="plan" busy={false} failed={false} onOpen={vi.fn()} onChooseUnit={onChooseUnit} />);
    expect(screen.getByText(/No hay destinos focales/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Elegir una unidad del plan actual" })); expect(onChooseUnit).toHaveBeenCalledTimes(1);
  });
});
