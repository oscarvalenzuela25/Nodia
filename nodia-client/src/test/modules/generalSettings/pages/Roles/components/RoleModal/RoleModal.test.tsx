import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import RoleModal from "../../../../../../../modules/generalSettings/pages/Roles/components/RoleModal";
import * as actionServices from "../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services";

vi.mock(
  "../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services",
  () => ({
    getActions: vi.fn(),
  })
);

const mockActionsResponse = {
  data: [
    {
      id: "act-1",
      key: "users.create",
      is_active: true,
      translates: [
        { key: "key", es: "Crear Usuarios", en: "Create Users" },
      ],
    },
    {
      id: "act-2",
      key: "users.read",
      is_active: true,
      translates: [
        { key: "key", es: "Ver Usuarios", en: "View Users" },
      ],
    },
  ],
  meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
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

describe("RoleModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actionServices.getActions).mockResolvedValue(mockActionsResponse);
  });

  it("renders create modal with empty fields, active switch enabled, and disabled submit button", () => {
    renderWithClient(
      <RoleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Nuevo Rol")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Identificador")).toBeInTheDocument();
    expect(screen.getByText("Acciones Asociadas")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: "Crear Rol" });
    expect(submitBtn).toBeDisabled();
  });

  it("enables submit button when key is provided and submits properly", async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <RoleModal
        open={true}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    const keyInput = screen.getByPlaceholderText(/super_admin/i);
    await user.type(keyInput, "custom_role");

    const submitBtn = screen.getByRole("button", { name: "Crear Rol" });
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "custom_role",
        isActive: true,
        translates: [
          {
            key: "key",
            es: "custom_role",
            en: "custom_role",
          },
        ],
      })
    );
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when cancel button is clicked", async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <RoleModal
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
      translates: [
        {
          key: "key",
          es: "Editor Principal",
          en: "Main Editor",
        },
      ],
    });
  });

  it("disables Cancel and Submit buttons when isSubmitting is true", () => {
    renderWithClient(
      <RoleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={true}
        initialData={{
          id: "role-123",
          key: "editor",
          actions: [],
          isActive: true,
        }}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    const submitBtn = screen.getByRole("button", { name: "Actualizar Rol" });

    expect(cancelBtn).toBeDisabled();
    expect(submitBtn).toBeDisabled();
  });

  it("fetches actions with all=true and includes=false when modal is opened", async () => {
    renderWithClient(
      <RoleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(actionServices.getActions).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
    });
  });

  it("renders action options in Translate (key) format", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <RoleModal
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(actionServices.getActions).toHaveBeenCalled();
    });

    const trigger = screen.getByRole("button", { name: /Acciones Asociadas/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByText("Crear Usuarios (users.create)")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Ver Usuarios (users.read)")
      ).toBeInTheDocument();
    });
  });
});
