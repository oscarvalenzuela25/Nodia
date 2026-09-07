import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ActionModal from "../../../../../../../modules/generalSettings/pages/Actions/components/ActionModal";
import * as moduleServices from "../../../../../../../modules/generalSettings/pages/Modules/infrastructure/services";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/Modules/infrastructure/services",
  () => ({
    getModules: vi.fn(),
  })
);

const mockModulesResponse = {
  data: [
    { id: "mod-parent", key: "settings", type: "module", parent_id: null },
    { id: "mod-sub", key: "general", type: "submodule", parent_id: "mod-parent" },
    { id: "mod-users", key: "users", type: "module", parent_id: null },
  ],
  meta: { page: 1, limit: 10, total_items: 3, total_pages: 1 },
};

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(moduleServices.getModules).mockResolvedValue(mockModulesResponse as any);
  });

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
    expect(screen.getByText("Módulo Asociado (Opcional)")).toBeInTheDocument();
    expect(screen.getByText("Descripción")).toBeInTheDocument();

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
          description: "Visualizar usuarios",
          moduleId: "users",
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
      moduleId: "users",
      moduleKey: "users",
      isActive: false,
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
          description: null,
          moduleKey: null,
          isActive: true,
        }}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const submitBtn = screen.getByRole("button", { name: "Actualizar Accionable" });

    expect(cancelBtn).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });

  it("fetches modules with all=true and includes=false when modal is opened", async () => {
    renderWithClient(
      <ActionModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(moduleServices.getModules).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
    });
  });
});
