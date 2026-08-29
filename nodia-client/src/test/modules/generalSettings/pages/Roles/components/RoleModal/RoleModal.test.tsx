import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import RoleModal from "../../../../../../../modules/generalSettings/pages/Roles/components/RoleModal";

describe("RoleModal", () => {
  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    render(
      <RoleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Rol")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador / Key")).toBeInTheDocument();
    expect(screen.getByText("Acciones Asociadas")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Rol" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is provided and submits properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <RoleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const keyInput = screen.getByPlaceholderText("ej: super_admin, editor, gestor");
    await user.type(keyInput, "custom_role");

    const submitBtn = screen.getByRole("button", { name: "Crear Rol" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "custom_role",
        isActive: true,
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it("renders edit modal with pre-populated data and allows updating", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <RoleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialData={{
          id: "role-123",
          key: "editor",
          nameTranslations: {
            es: "Editor Principal",
            en: "Main Editor",
          },
          actions: ["users.read"],
          isActive: false,
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Rol" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("editor")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Editor Principal")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Actualizar Rol" });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "role-123",
      key: "editor",
      nameTranslations: {
        es: "Editor Principal",
        en: "Main Editor",
      },
      actions: ["users.read"],
      isActive: false,
    });
  });
});
