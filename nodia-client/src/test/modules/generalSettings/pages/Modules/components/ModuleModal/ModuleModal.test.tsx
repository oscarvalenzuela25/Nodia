import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ModuleModal from "../../../../../../../modules/generalSettings/pages/Modules/components/ModuleModal";

describe("ModuleModal", () => {
  const availableParents = [
    { value: "general_settings", label: "Ajustes Generales" },
    { value: "security", label: "Seguridad y Accesos" },
  ];

  it("renders create modal with empty key, module type selected, active switch enabled, and disabled submit button", () => {
    render(
      <ModuleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        availableParents={availableParents}
      />
    );

    expect(screen.getByText("Nuevo Módulo")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador / Key")).toBeInTheDocument();
    expect(screen.getByText("Tipo de Elemento")).toBeInTheDocument();
    expect(screen.getByText("Módulo")).toBeInTheDocument();

    // Parent module select is not visible when type is 'module'
    expect(
      screen.queryByText("Módulo Padre (Requerido para submódulos)")
    ).not.toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is entered for a root module and submits properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        availableParents={availableParents}
      />
    );

    const keyInput = screen.getByPlaceholderText(
      "ej: general_settings, users, security"
    );
    fireEvent.change(keyInput, { target: { value: "analytics" } });

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "analytics",
        type: "module",
        parentId: null,
        isActive: true,
      })
    );
    expect(handleClose).toHaveBeenCalled();
  });

  it("requires parent module when type is submodule", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        availableParents={availableParents}
      />
    );

    const keyInput = screen.getByPlaceholderText(
      "ej: general_settings, users, security"
    );
    fireEvent.change(keyInput, { target: { value: "reports" } });

    // Open Type selector and change to Submódulo
    const typeTrigger = screen.getByRole("button", { name: "Tipo de Elemento" });
    await user.click(typeTrigger);
    await user.click(screen.getByText("Submódulo"));

    // Now parent module field should be visible
    expect(
      screen.getByText("Módulo Padre (Requerido para submódulos)")
    ).toBeInTheDocument();

    // Submit button should be disabled because no parent is selected
    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    expect(submitBtn).toBeDisabled();

    // Select a parent module
    const parentTrigger = screen.getByRole("button", {
      name: "Módulo Padre (Requerido para submódulos)",
    });
    await user.click(parentTrigger);
    await user.click(screen.getByText("Ajustes Generales"));

    // Now submit button should be enabled
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "reports",
        type: "submodule",
        parentId: "general_settings",
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
      <ModuleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialData={{
          id: "mod-123",
          key: "users",
          type: "submodule",
          parentId: "general_settings",
          nameTranslations: {
            es: "Usuarios",
            en: "Users",
          },
          isActive: false,
        }}
        availableParents={availableParents}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Módulo" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Actualizar Módulo" });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "mod-123",
      key: "users",
      type: "submodule",
      parentId: "general_settings",
      parentKey: "general_settings",
      nameTranslations: {
        es: "Usuarios",
        en: "Users",
      },
      isActive: false,
    });
  });
});
