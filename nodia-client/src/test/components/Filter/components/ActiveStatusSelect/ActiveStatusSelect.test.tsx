import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ActiveStatusSelect, { type ActiveFilterStatus } from "../../../../../components/Filter/components/ActiveStatusSelect";
import i18n from "../../../../../translate";

function ControlledSelect() {
  const [value, setValue] = useState<ActiveFilterStatus>("active");
  return <ActiveStatusSelect value={value} onChange={setValue} />;
}

describe("ActiveStatusSelect", () => {
  it("defaults to active and offers exactly active, inactive and all", async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);
    expect(screen.getByRole("button", { name: "Estado de actividad" })).toHaveTextContent("Activo");
    for (const label of ["Inactivo", "Todos", "Activo"]) {
      await user.click(screen.getByRole("button", { name: "Estado de actividad" }));
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Activo", "Inactivo", "Todos"]);
      await user.click(screen.getByRole("option", { name: label }));
      expect(screen.getByRole("button", { name: "Estado de actividad" })).toHaveTextContent(label);
    }
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /limpiar selección/i })).not.toBeInTheDocument();
  });

  it("uses the shared English labels and blocks interaction while busy", async () => {
    await i18n.changeLanguage("en");
    const onChange = vi.fn();
    render(<ActiveStatusSelect disabled onChange={onChange} />);
    const field = screen.getByRole("button", { name: "Activity status" });
    expect(field).toHaveTextContent("Active");
    expect(field).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(field);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
