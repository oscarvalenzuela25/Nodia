import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ActionModal from "../../../../../../../modules/generalSettings/pages/Actions/components/ActionModal";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("ActionModal", () => {
  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    renderWithClient(
      <ActionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Accionable")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(
      screen.queryByText("Módulo Asociado (Opcional)")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Traducciones de la Descripción")
    ).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Accionable" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is entered and submits form properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <ActionModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const keyInput = screen.getByPlaceholderText(/users\.create/i);
    fireEvent.change(keyInput, { target: { value: "users.export" } });

    const descEsInput = screen.getByPlaceholderText(
      /Permite crear y gestionar nuevos usuarios/i
    );
    fireEvent.change(descEsInput, {
      target: { value: "Permite exportar usuarios a Excel" },
    });

    const descEnInput = screen.getByPlaceholderText(
      /Allows creating and managing new users/i
    );
    fireEvent.change(descEnInput, {
      target: { value: "Allows exporting users to Excel" },
    });

    const submitBtn = screen.getByRole("button", { name: "Crear Accionable" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith({
      key: "users.export",
      isActive: true,
      description: null,
      nameTranslations: { es: "", en: "" },
      descriptionTranslations: {
        es: "Permite exportar usuarios a Excel",
        en: "Allows exporting users to Excel",
      },
      translates: [
        {
          key: "key",
          es: "users.export",
          en: "users.export",
        },
        {
          key: "comment",
          es: "Permite exportar usuarios a Excel",
          en: "Allows exporting users to Excel",
        },
      ],
    });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <ActionModal
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

    renderWithClient(
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
          descriptionTranslations: {
            es: "Visualizar usuarios",
            en: "View users",
          },
          description: null,
          isActive: false,
        }}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Actualizar Accionable" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users.read")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Visualizar usuarios")).toBeInTheDocument();
    expect(screen.getByDisplayValue("View users")).toBeInTheDocument();

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
      descriptionTranslations: {
        es: "Visualizar usuarios",
        en: "View users",
      },
      description: null,
      isActive: false,
      translates: [
        {
          key: "key",
          es: "Ver Usuarios",
          en: "View Users",
        },
        {
          key: "comment",
          es: "Visualizar usuarios",
          en: "View users",
        },
      ],
    });
  });

  it("disables Cancel and Submit buttons when isSubmitting is true", () => {
    renderWithClient(
      <ActionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={true}
        initialData={{
          id: "act-123",
          key: "users.read",
          nameTranslations: { es: "", en: "" },
          descriptionTranslations: { es: "", en: "" },
          description: null,
          isActive: true,
        }}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const submitBtn = screen.getByRole("button", {
      name: "Actualizar Accionable",
    });

    expect(cancelBtn).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });
});
