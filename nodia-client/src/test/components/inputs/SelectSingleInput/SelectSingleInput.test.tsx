import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SelectSingleInput from "../../../../../src/components/inputs/SelectSingleInput";

describe("SelectSingleInput", () => {
  const options = [
    { value: "users", label: "Módulo de Usuarios" },
    { value: "roles", label: "Módulo de Roles" },
    { value: "settings", label: "Módulo de Configuración" },
  ];

  it("renders label, placeholder and open popover on click", async () => {
    const user = userEvent.setup();
    render(
      <SelectSingleInput
        label="Módulo"
        options={options}
        value={null}
        onChange={vi.fn()}
        placeholder="Seleccionar módulo..."
      />
    );

    expect(screen.getByText("Módulo")).toBeInTheDocument();
    expect(screen.getByText("Seleccionar módulo...")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /Módulo/i });
    await user.click(trigger);

    expect(screen.getByText("Módulo de Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Módulo de Roles")).toBeInTheDocument();
    expect(screen.getByText("Módulo de Configuración")).toBeInTheDocument();
  });

  it("allows filtering and selecting an option", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectSingleInput
        label="Módulo"
        options={options}
        value={null}
        onChange={handleChange}
        searchPlaceholder="Buscar módulo..."
      />
    );

    const trigger = screen.getByRole("button", { name: /Módulo/i });
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText("Buscar módulo...");
    await user.type(searchInput, "Roles");

    expect(screen.getByText("Módulo de Roles")).toBeInTheDocument();
    expect(screen.queryByText("Módulo de Usuarios")).not.toBeInTheDocument();

    await user.click(screen.getByText("Módulo de Roles"));

    expect(handleChange).toHaveBeenCalledWith("roles");
  });

  it("displays selected value and allows clearing", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectSingleInput
        label="Módulo"
        options={options}
        value="settings"
        onChange={handleChange}
        clearable={true}
      />
    );

    expect(screen.getByText("Módulo de Configuración")).toBeInTheDocument();

    const clearButton = screen.getByRole("button", {
      name: /clear selection/i,
    });
    await user.click(clearButton);

    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
