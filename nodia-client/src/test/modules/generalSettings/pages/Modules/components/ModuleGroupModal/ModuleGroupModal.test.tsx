import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import ModuleGroupModal from "../../../../../../../modules/generalSettings/pages/Modules/components/ModuleGroupModal";

describe("ModuleGroupModal", () => {
  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    render(
      <ModuleGroupModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Grupo de Módulos")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Grupo" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is entered and submits with proper translates", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleGroupModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Crear Grupo" });
    expect(submitBtn).toBeDisabled();

    const keyInput = screen.getByPlaceholderText(/users, roles, settings/i);
    await user.type(keyInput, "settings");

    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      key: "settings",
      isActive: true,
      nameTranslations: { es: "", en: "" },
      translates: [
        {
          key: "key",
          es: "settings",
          en: "settings",
        },
      ],
    });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ModuleGroupModal
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
    const user = userEvent.setup();

    render(
      <ModuleGroupModal
        open={true}
        onClose={vi.fn()}
        onSubmit={handleSubmit}
        initialData={{
          id: "grp-1",
          key: "settings",
          nameTranslations: {
            es: "Ajustes",
            en: "Settings",
          },
          isActive: false,
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Grupo de Módulos" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("settings")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", {
      name: "Actualizar Grupo",
    });
    expect(updateBtn).toBeEnabled();

    await user.click(updateBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      id: "grp-1",
      key: "settings",
      nameTranslations: {
        es: "Ajustes",
        en: "Settings",
      },
      isActive: false,
      translates: [
        {
          key: "key",
          es: "Ajustes",
          en: "Settings",
        },
      ],
    });
  });

  it("disables Cancel and Submit buttons when isSubmitting is true", () => {
    render(
      <ModuleGroupModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={true}
        initialData={{
          id: "grp-1",
          key: "settings",
          nameTranslations: { es: "", en: "" },
          isActive: true,
        }}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const submitBtn = screen.getByRole("button", {
      name: "Actualizar Grupo",
    });

    expect(cancelBtn).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });
});
