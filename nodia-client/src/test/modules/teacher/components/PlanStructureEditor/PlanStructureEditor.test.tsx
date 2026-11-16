import { useEffect, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PlanStructureEditor from "../../../../../modules/teacher/components/PlanStructureEditor";
import type { Outline } from "../../../../../modules/teacher/infrastructure/schemas";
import { planFixture } from "../../fixtures";

function Harness({ initial = planFixture.outline, busy = false, onValue }: { initial?: Outline; busy?: boolean; onValue: (value: Outline) => void }) {
  const [value, setValue] = useState(() => structuredClone(initial));
  useEffect(() => { onValue(value); }, [onValue, value]);
  return <PlanStructureEditor value={value} busy={busy} onChange={setValue} onValidation={() => {}} />;
}

describe("Teacher progressive structure editor", () => {
  it("retains edited objective and unit identities when the expanded section is reordered", async () => {
    const initial = structuredClone(planFixture.outline);
    initial.sections.push({ id: "s2", title: "TLS", required: true, prerequisite_section_ids: ["s1"],
      objectives: [{ id: "o2", description: "Explain encryption" }],
      units: [{ id: "u2", title: "TLS handshake", objective_ids: ["o2"], day_start: null, day_end: null }],
    });
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={initial} onValue={onValue} />);
    expect(screen.queryByRole("textbox", { name: "Objetivo 1" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^DNS/ }));
    const objective = screen.getByRole("textbox", { name: "Objetivo 1" });
    fireEvent.change(objective, { target: { value: "Explain DNS caching" } });
    await user.click(screen.getByRole("button", { name: "Bajar sección" }));
    expect(screen.getByRole("textbox", { name: "Objetivo 1" })).toBe(objective);
    expect(objective).toHaveValue("Explain DNS caching");
    const outline = onValue.mock.lastCall?.[0] as Outline;
    expect(outline.sections.map(section => section.id)).toEqual(["s2", "s1"]);
    expect(outline.sections[1].objectives).toEqual([{ id: "o1", description: "Explain DNS caching" }]);
    expect(outline.sections[1].units).toEqual(initial.sections[0].units);
    expect(outline.sections[0].prerequisite_section_ids).toEqual(["s1"]);
  });

  it("opens a newly added section with linked unique IDs and retains it through busy changes", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Harness onValue={onValue} />);
    await user.click(screen.getByRole("button", { name: "Añadir sección" }));
    const title = screen.getByRole("textbox", { name: "Sección 2" });
    fireEvent.change(title, { target: { value: "New synthetic section" } });
    const outline = onValue.mock.lastCall?.[0] as Outline;
    const added = outline.sections[1];
    expect(added.title).toBe("New synthetic section");
    expect(new Set([added.id, added.objectives[0].id, added.units[0].id]).size).toBe(3);
    expect(added.units[0].objective_ids).toEqual([added.objectives[0].id]);
    rerender(<Harness onValue={onValue} busy />);
    expect(title).toBeDisabled();
    expect(screen.getByRole("button", { name: "Añadir sección" })).toBeDisabled();
    rerender(<Harness onValue={onValue} />);
    await waitFor(() => expect(title).toBeEnabled());
    expect(screen.getByRole("textbox", { name: "Sección 2" })).toBe(title);
    expect(title).toHaveValue("New synthetic section");
  });
});
