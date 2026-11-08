import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StudyJourney from "../../../../../modules/teacher/components/StudyJourney";
import type { Session } from "../../../../../modules/teacher/infrastructure/schemas";
import { planFixture } from "../../fixtures";

// Synthetic plan: ordinals indicate structure only, never completed work.
const outline = { ...planFixture.outline, sections: ["alpha", "beta", "gamma"].map(id => ({
  id, title: `Fixture section ${id}`, required: true, prerequisite_section_ids: [],
  objectives: [{ id: `objective-${id}`, description: `Fixture objective ${id}` }],
  units: [{ id: `unit-${id}`, title: `Fixture unit ${id}`, objective_ids: [`objective-${id}`], day_start: null, day_end: null }],
})) };
const sectionStates: Session["section_states"] = [
  { section_id: "alpha", verification_state: "not_verified", allowed_actions: { start_final: { enabled: true, reason_code: null } } },
  { section_id: "beta", verification_state: "not_verified", allowed_actions: { start_final: { enabled: false, reason_code: "fixture-blocked" } } },
];
const callbacks = () => ({ onSelectUnit: vi.fn(), onStartFinal: vi.fn(), onExpandedChange: vi.fn() });
const section = (id: string) => screen.getByRole("button", { name: new RegExp(`Fixture section ${id}`) });

describe("Teacher study journey", () => {
  it("opens the actual unit section, marks only its current unit and keeps objectives on demand", async () => {
    render(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-beta" busy={false} expanded {...callbacks()} />);
    expect(screen.getByRole("heading", { name: "Tu recorrido", level: 2 })).toBeVisible();
    expect(section("alpha")).toHaveAttribute("aria-expanded", "false");
    expect(section("beta")).toHaveAttribute("aria-expanded", "true");
    const unit = screen.getByRole("button", { name: "Fixture unit beta" });
    expect(unit).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("Fixture objective beta")).not.toBeVisible();
    const objectives = screen.getAllByText("Objetivos de la sección").find(node => node.closest('details')?.parentElement?.contains(unit));
    expect(objectives).toBeDefined(); await userEvent.click(objectives!);
    expect(screen.getByText("Fixture objective beta")).toBeVisible();
    expect(screen.queryByText(/completad/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("uses keyboard sections and passes exact unit and final IDs without inferring permission", async () => {
    const props = callbacks(); const user = userEvent.setup();
    render(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-beta" busy={false} expanded {...props} />);
    section("alpha").focus(); await user.keyboard("{Enter}");
    expect(section("alpha")).toHaveAttribute("aria-expanded", "true");
    expect(section("beta")).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "Fixture unit alpha" }));
    expect(props.onSelectUnit).toHaveBeenCalledExactlyOnceWith("alpha", "unit-alpha");
    await user.click(screen.getByRole("button", { name: "Ir a la prueba final" }));
    expect(props.onStartFinal).toHaveBeenCalledExactlyOnceWith("alpha");
    await user.click(section("gamma"));
    expect(screen.getByRole("button", { name: "Ir a la prueba final" })).toBeDisabled();
  });
  it("follows external A→B→A navigation after manually opening C without reviving the old C expansion", async () => {
    const props = callbacks();
    const { rerender } = render(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-alpha" busy={false} expanded {...props} />);
    await userEvent.click(section("gamma")); expect(section("gamma")).toHaveAttribute("aria-expanded", "true");
    rerender(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-beta" busy={false} expanded {...props} />);
    expect(section("beta")).toHaveAttribute("aria-expanded", "true");
    rerender(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-alpha" busy={false} expanded {...props} />);
    expect(section("alpha")).toHaveAttribute("aria-expanded", "true");
    expect(section("gamma")).toHaveAttribute("aria-expanded", "false");
    expect(props.onSelectUnit).not.toHaveBeenCalled(); expect(props.onStartFinal).not.toHaveBeenCalled();
  });
  it("preserves a unit control through busy revalidation and blocks both actions in the handler", () => {
    const props = callbacks();
    const { rerender } = render(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-alpha" busy={false} expanded {...props} />);
    const unit = screen.getByRole("button", { name: "Fixture unit alpha" }); unit.focus();
    rerender(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-alpha" busy expanded {...props} />);
    expect(screen.getByRole("button", { name: "Fixture unit alpha" })).toBe(unit); expect(unit).toBeDisabled();
    fireEvent.click(unit); fireEvent.click(screen.getByRole("button", { name: "Ir a la prueba final" }));
    expect(props.onSelectUnit).not.toHaveBeenCalled(); expect(props.onStartFinal).not.toHaveBeenCalled();
    rerender(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId="unit-alpha" busy={false} expanded {...props} />);
    expect(unit).toBeEnabled(); expect(unit).toHaveFocus();
  });
  it("retains the outer mobile disclosure and an honest empty state without invented units", async () => {
    const props = callbacks();
    const { rerender } = render(<StudyJourney outline={outline} sectionStates={sectionStates} selectedUnitId={null} busy={false} expanded={false} {...props} />);
    const heading = screen.getByRole("button", { name: "Tu recorrido" });
    expect(heading).toHaveAttribute("aria-expanded", "false"); await userEvent.click(heading);
    expect(props.onExpandedChange).toHaveBeenCalledExactlyOnceWith(true);
    rerender(<StudyJourney outline={{ ...outline, sections: [] }} sectionStates={[]} selectedUnitId={null} busy={false} expanded {...props} />);
    expect(screen.getByText("No se encontraron datos para mostrar en este momento.")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Tu recorrido" })).queryByRole("button")).not.toBeInTheDocument();
  });
});
