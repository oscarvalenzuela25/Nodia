import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import UserModal from "../../../../../../../modules/generalSettings/pages/Users/components/UserModal";

describe("UserModal", () => {
  it("renders create modal with empty fields and default active switch", () => {
    render(
      <UserModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Usuario")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Correo Electrónico")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("URL de imagen")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Usuario" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when email is provided and submits form", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <UserModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const emailInput = screen.getByPlaceholderText("correo@ejemplo.com");
    await user.type(emailInput, "nuevo@ejemplo.com");

    const nameInput = screen.getByPlaceholderText("Ingresa el nombre");
    await user.type(nameInput, "Carlos Lopez");

    const submitBtn = screen.getByRole("button", { name: "Crear Usuario" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nuevo@ejemplo.com",
        name: "Carlos Lopez",
        isActive: true,
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it("renders update modal when initialData is provided", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <UserModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialData={{
          id: "123",
          name: "Existing User",
          email: "existing@example.com",
          roles: ["Admin"],
          isActive: false,
          imageUrl: "https://example.com/pic.jpg",
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Usuario" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing User")).toBeInTheDocument();
    expect(screen.getByDisplayValue("existing@example.com")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Actualizar Usuario" });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "123",
      name: "Existing User",
      email: "existing@example.com",
      roles: ["Admin"],
      isActive: false,
      imageUrl: "https://example.com/pic.jpg",
    });
  });
});
