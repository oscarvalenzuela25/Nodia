import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import Users from "../../../../../modules/generalSettings/pages/Users/Users";

describe("Users Page", () => {
  it("renders users table with expected columns and does not render 'Permitido'", () => {
    render(<Users />);

    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Id")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Correo Electrónico")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();

    // Verify "Permitido" column is removed
    expect(screen.queryByText("Permitido")).not.toBeInTheDocument();

    // Initial users
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("juan@example.com")).toBeInTheDocument();
    expect(screen.getByText("correo@example.com")).toBeInTheDocument();
  });

  it("filters users using InputSearch by name", async () => {
    const user = userEvent.setup();
    render(<Users />);

    const searchInput = screen.getByPlaceholderText("Buscar por nombre...");
    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();

    await user.type(searchInput, "Maria");

    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument();
  });

  it("opens create user modal when clicking 'Nuevo usuario'", async () => {
    const user = userEvent.setup();
    render(<Users />);

    const newUserButton = screen.getByRole("button", { name: /Nuevo usuario/i });
    await user.click(newUserButton);

    expect(screen.getByText("Nuevo Usuario")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ingresa el nombre")).toBeInTheDocument();
  });

  it("opens action menu with 'Actualizar' and opens edit modal with user data", async () => {
    const user = userEvent.setup();
    render(<Users />);

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Usuario" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Juan Perez")).toBeInTheDocument();
    expect(screen.getByDisplayValue("juan@example.com")).toBeInTheDocument();
  });
});
