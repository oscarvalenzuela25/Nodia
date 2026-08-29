import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ActionModal from "../../../../../../../modules/generalSettings/pages/Actions/components/ActionModal";

describe("ActionModal", () => {
  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    render(
      <ActionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Accionable")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador / Key")).toBeInTheDocument();
    expect(screen.getByText("Módulo Asociado (Opcional)")).toBeInTheDocument();
    expect(screen.getByText("Descripción")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Accionable" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is entered and submits form properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ActionModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        availableModules={[{ value: "users", label: "Módulo de Usuarios" }]}
      />
    );

    const keyInput = screen.getByPlaceholderText("ej: users.create, roles.manage");
    fireEvent.change(keyInput, { target: { value: "users.export" } });

    const descInput = screen.getByPlaceholderText(
      "Describe el propósito funcional o técnico de este accionable..."
    );
    fireEvent.change(descInput, {
      target: { value: "Permite exportar usuarios a Excel" },
    });

    const submitBtn = screen.getByRole("button", { name: "Crear Accionable" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "users.export",
        description: "Permite exportar usuarios a Excel",
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
      <ActionModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialData={{
          id: "act-123",
          key: "users.read",
          nameTranslations: {
            es: "Ver Usuarios",
            en: "View Users",
          },
          description: "Visualizar usuarios",
          moduleKey: "users",
          isActive: false,
        }}
        availableModules={[{ value: "users", label: "Módulo de Usuarios" }]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Accionable" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users.read")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Visualizar usuarios")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", {
      name: "Actualizar Accionable",
    });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "act-123",
      key: "users.read",
      nameTranslations: {
        es: "Ver Usuarios",
        en: "View Users",
      },
      description: "Visualizar usuarios",
      moduleKey: "users",
      isActive: false,
    });
  });
});
