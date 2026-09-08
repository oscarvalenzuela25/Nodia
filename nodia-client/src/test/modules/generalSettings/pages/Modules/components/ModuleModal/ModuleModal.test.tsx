import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ModuleModal from "../../../../../../../modules/generalSettings/pages/Modules/components/ModuleModal";

describe("ModuleModal", () => {
  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    render(
      <ModuleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Módulo")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(screen.getByText("Grupo")).toBeInTheDocument();

    // Elements from old hierarchical model are not present
    expect(screen.queryByText("Tipo de Elemento")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Módulo Padre (Requerido para submódulos)")
    ).not.toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key and group_by are entered, and submits properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    expect(submitBtn).toBeDisabled();

    const keyInput = screen.getByPlaceholderText(/users, roles, settings/i);
    await user.type(keyInput, "analytics");

    // Still disabled without group_by
    expect(submitBtn).toBeDisabled();

    const groupInput = screen.getByPlaceholderText(/settings, catalog/i);
    await user.type(groupInput, "reports_group");

    // Enabled now
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      key: "analytics",
      group_by: "reports_group",
      isActive: true,
      nameTranslations: { es: "", en: "" },
      translates: [
        {
          key: "key",
          es: "analytics",
          en: "analytics",
        },
      ],
    });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleModal
        open={true}
        onClose={handleClose}
        onSubmit={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
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
          group_by: "administration",
          nameTranslations: {
            es: "Usuarios",
            en: "Users",
          },
          isActive: false,
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Módulo" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users")).toBeInTheDocument();
    expect(screen.getByDisplayValue("administration")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Actualizar Módulo" });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "mod-123",
      key: "users",
      group_by: "administration",
      nameTranslations: {
        es: "Usuarios",
        en: "Users",
      },
      isActive: false,
      translates: [
        {
          key: "key",
          es: "Usuarios",
          en: "Users",
        },
      ],
    });
  });

  it("disables Cancel and Submit buttons when isSubmitting is true", () => {
    render(
      <ModuleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={true}
        initialData={{
          id: "mod-123",
          key: "users",
          group_by: "admin",
          nameTranslations: { es: "", en: "" },
          isActive: true,
        }}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const submitBtn = screen.getByRole("button", {
      name: "Actualizar Módulo",
    });

    expect(cancelBtn).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });
});
