import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import Modules from "../../../../../modules/generalSettings/pages/Modules/Modules";

describe("Modules Page", () => {
  it("renders modules table with expected columns and initial dummy modules", () => {
    render(<Modules />);

    expect(screen.getAllByText("Módulos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Id")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(screen.getByText("Nombre del módulo")).toBeInTheDocument();
    expect(screen.getByText("Tipo")).toBeInTheDocument();
    expect(screen.getByText("Módulo padre")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();

    // Verify initial keys and display names
    expect(screen.getByText("general_settings")).toBeInTheDocument();
    expect(screen.getAllByText("Ajustes Generales").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("users")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getAllByText("Sin módulo padre").length).toBeGreaterThanOrEqual(1);
  });

  it("filters modules using InputSearch only by name or identifier", async () => {
    const user = userEvent.setup();
    render(<Modules />);

    const searchInput = screen.getByPlaceholderText(
      "Buscar por nombre o identificador..."
    );
    expect(screen.getAllByText("Ajustes Generales").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Seguridad y Accesos").length).toBeGreaterThanOrEqual(1);

    // Search by name
    await user.type(searchInput, "Seguridad");
    expect(screen.getAllByText("Seguridad y Accesos").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("general_settings")).not.toBeInTheDocument();

    await user.clear(searchInput);

    // Search by key / identifier
    await user.type(searchInput, "general_settings");
    expect(screen.getByText("general_settings")).toBeInTheDocument();
    expect(screen.queryByText("Seguridad y Accesos")).not.toBeInTheDocument();
  });

  it("opens create module modal when clicking 'Nuevo Módulo'", async () => {
    const user = userEvent.setup();
    render(<Modules />);

    const newModuleBtn = screen.getByRole("button", {
      name: /Nuevo Módulo/i,
    });
    await user.click(newModuleBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Módulo" })
    ).toBeInTheDocument();
    expect(screen.getByText("Identificador / Key")).toBeInTheDocument();
  });

  it("opens action menu with 'Actualizar' and opens edit modal with prefilled data", async () => {
    const user = userEvent.setup();
    render(<Modules />);

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Módulo" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("general_settings")).toBeInTheDocument();
  });
});
