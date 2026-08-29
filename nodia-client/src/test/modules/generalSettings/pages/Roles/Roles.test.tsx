import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import Roles from "../../../../../modules/generalSettings/pages/Roles/Roles";

describe("Roles Page", () => {
  it("renders roles table with expected columns and initial dummy roles", () => {
    render(<Roles />);

    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("Id")).toBeInTheDocument();
    expect(screen.getByText("Nombre del rol")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(screen.getByText("Acciones asociadas")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();

    // Verify initial role keys and display names
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("manager")).toBeInTheDocument();
    expect(screen.getByText("editor")).toBeInTheDocument();
    expect(screen.getByText("Super Administrador")).toBeInTheDocument();
    expect(screen.getByText("Gerente de Operaciones")).toBeInTheDocument();
  });

  it("filters roles using InputSearch by name or identifier", async () => {
    const user = userEvent.setup();
    render(<Roles />);

    const searchInput = screen.getByPlaceholderText(
      "Buscar por nombre o identificador..."
    );
    expect(screen.getByText("Super Administrador")).toBeInTheDocument();
    expect(screen.getByText("Editor de Recursos")).toBeInTheDocument();

    await user.type(searchInput, "editor");

    expect(screen.getByText("Editor de Recursos")).toBeInTheDocument();
    expect(screen.queryByText("Super Administrador")).not.toBeInTheDocument();
  });

  it("opens create role modal when clicking 'Nuevo Rol'", async () => {
    const user = userEvent.setup();
    render(<Roles />);

    const newRoleButton = screen.getByRole("button", { name: /Nuevo Rol/i });
    await user.click(newRoleButton);

    expect(
      screen.getByRole("heading", { name: "Nuevo Rol" })
    ).toBeInTheDocument();
    expect(screen.getByText("Identificador / Key")).toBeInTheDocument();
  });

  it("opens action menu with 'Actualizar' and opens edit modal with prefilled data", async () => {
    const user = userEvent.setup();
    render(<Roles />);

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Rol" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin")).toBeInTheDocument();
  });
});
