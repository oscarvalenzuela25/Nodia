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

async function chooseView(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: "Qué quieres editar" }));
  await user.click(screen.getByRole("option", { name: label }));
}

describe("Teacher progressive structure editor", () => {
  it("edits the selected section and retains its fields and prerequisites when reordered", async () => {
    const initial = structuredClone(planFixture.outline);
    initial.sections.push({ id: "s2", title: "TLS", required: true, prerequisite_section_ids: ["s1"],
      objectives: [{ id: "o2", description: "Explain encryption" }],
      units: [{ id: "u2", title: "TLS handshake", objective_ids: ["o2"], day_start: null, day_end: null }],
    });
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness initial={initial} onValue={onValue} />);
    expect(screen.queryByRole("textbox", { name: "Objetivo 1" })).not.toBeInTheDocument();
    await chooseView(user, "DNS");
    expect(screen.queryByRole("textbox", { name: "Título del plan de estudio (opcional)" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Lo que aprenderás"));
    const objective = screen.getByRole("textbox", { name: "Objetivo 1" });
    fireEvent.change(objective, { target: { value: "Explain DNS caching" } });
    await user.click(screen.getByText("Organización y requisitos"));
    await user.click(screen.getByRole("button", { name: "Bajar sección" }));
    expect(screen.getByRole("textbox", { name: "Objetivo 1" })).toBe(objective);
    expect(objective).toHaveValue("Explain DNS caching");
    const outline = onValue.mock.lastCall?.[0] as Outline;
    expect(outline.sections.map(section => section.id)).toEqual(["s2", "s1"]);
    expect(outline.sections[1].objectives).toEqual([{ id: "o1", description: "Explain DNS caching" }]);
    expect(outline.sections[1].units).toEqual(initial.sections[0].units);
    expect(outline.sections[0].prerequisite_section_ids).toEqual(["s1"]);
    await chooseView(user, "TLS");
    expect(screen.getByRole("textbox", { name: "Sección 1" })).toHaveValue("TLS");
    await chooseView(user, "DNS");
    await user.click(screen.getByText("Lo que aprenderás"));
    expect(screen.getByRole("textbox", { name: "Objetivo 1" })).toHaveValue("Explain DNS caching");
  });

  it("opens a newly added section with linked unique IDs and retains it through busy changes", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Harness onValue={onValue} />);
    await user.click(screen.getByRole("button", { name: "Añadir sección" }));
    expect(screen.getByRole("heading", { name: "Sección 2" })).toHaveFocus();
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

  it("opens and focuses a new unit while keeping the section's objective references", async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Harness onValue={onValue} />);
    await chooseView(user, "DNS");
    await user.click(screen.getByRole("button", { name: "Añadir unidad" }));
    const title = screen.getByRole("textbox", { name: "Unidad 2" });
    expect(title.closest("details")).toHaveAttribute("open");
    expect(title).toHaveFocus();
    fireEvent.change(title, { target: { value: "Cache" } });
    const outline = onValue.mock.lastCall?.[0] as Outline;
    expect(outline.sections[0].units[1]).toMatchObject({ title: "Cache", objective_ids: ["o1"] });
  });
});
