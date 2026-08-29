import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import Actions from "../../../../../modules/generalSettings/pages/Actions/Actions";

describe("Actions Page", () => {
  it("renders actions table with expected columns and initial dummy actions", () => {
    render(<Actions />);

    expect(screen.getAllByText("Acciones").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Id")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(screen.getByText("Descripción")).toBeInTheDocument();
    expect(screen.getByText("Módulo asociado")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();

    // Verify initial action keys and display names
    expect(screen.getByText("users.create")).toBeInTheDocument();
    expect(screen.getByText("Crear Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Ver Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Sin módulo asociado")).toBeInTheDocument();
  });

  it("filters actions using InputSearch by name, key, description, or module", async () => {
    const user = userEvent.setup();
    render(<Actions />);

    const searchInput = screen.getByPlaceholderText(
      "Buscar por nombre, clave o descripción..."
    );
    expect(screen.getByText("Crear Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Gestionar Roles")).toBeInTheDocument();

    await user.type(searchInput, "Gestionar");

    expect(screen.getByText("Gestionar Roles")).toBeInTheDocument();
    expect(screen.queryByText("Crear Usuarios")).not.toBeInTheDocument();
  });

  it("opens create action modal when clicking 'Nuevo Accionable'", async () => {
    const user = userEvent.setup();
    render(<Actions />);

    const newActionBtn = screen.getByRole("button", {
      name: /Nuevo Accionable/i,
    });
    await user.click(newActionBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Accionable" })
    ).toBeInTheDocument();
    expect(screen.getByText("Identificador / Key")).toBeInTheDocument();
  });

  it("opens action menu with 'Actualizar' and opens edit modal with prefilled data", async () => {
    const user = userEvent.setup();
    render(<Actions />);

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Accionable" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users.create")).toBeInTheDocument();
  });
});
