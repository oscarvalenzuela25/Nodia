import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import BusinessCollaboratorModal from "../../../../../../../modules/business/pages/Business/components/BusinessCollaboratorModal";
import * as userServices from "../../../../../../../modules/generalSettings/pages/Users/infrastructure/services";
import * as actionServices from "../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import useAuthStore from "../../../../../../../store/authStore";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock(
  "../../../../../../../modules/generalSettings/pages/Users/infrastructure/services",
  () => ({
    getUsers: vi.fn(),
  })
);

vi.mock(
  "../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services",
  () => ({
    getBusinessActions: vi.fn(),
  })
);

vi.mock(
  "../../../../../../../modules/business/infrastructure/services",
  () => ({
    assignCollaborators: vi.fn(),
  })
);

const mockUsers = [
  {
    id: "42",
    name: "Test user",
    email: "test@example.com",
    is_active: true,
    roles: [],
    image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-1",
    name: "Juan Perez",
    email: "juan@example.com",
    is_active: true,
    roles: [],
    image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-2",
    name: "Maria Gomez",
    email: "maria@example.com",
    is_active: true,
    roles: [],
    image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockBusinessActions = [
  {
    id: "ba-1",
    key: "products.create",
    has_description: false,
    is_active: true,
    translates: [{ key: "key", es: "Crear Productos", en: "Create Products" }],
  },
  {
    id: "ba-2",
    key: "orders.manage",
    has_description: false,
    is_active: true,
    translates: [{ key: "key", es: "Gestionar Pedidos", en: "Manage Orders" }],
  },
];

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

describe("BusinessCollaboratorModal", () => {
  beforeEach(() => {
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test user" },
    });
    vi.clearAllMocks();
    vi.mocked(userServices.getUsers).mockResolvedValue({
      data: mockUsers,
      meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
    });
    vi.mocked(actionServices.getBusinessActions).mockResolvedValue({
      data: mockBusinessActions,
      meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
    });
    vi.mocked(businessServices.assignCollaborators).mockResolvedValue([]);
  });

  it("renders modal with header and add collaborator button", async () => {
    renderWithClient(
      <BusinessCollaboratorModal
        open={true}
        onClose={vi.fn()}
        businessId="biz-1"
        businessName="Mi Tienda"
      />
    );

    expect(
      screen.getByText("Gestionar Colaboradores del Negocio")
    ).toBeInTheDocument();
    expect(screen.getByText("Colaborador #1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Agregar nuevo colaborador/i })
    ).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    expect(saveBtn).toBeDisabled();
  });

  it("reveals action selection when a user is selected, and enforces at least 1 action before saving", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithClient(
      <BusinessCollaboratorModal
        open={true}
        onClose={handleClose}
        businessId="biz-1"
        businessName="Mi Tienda"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Busca y selecciona un usuario...")
      ).toBeInTheDocument();
    });

    // Select user
    const selectTrigger = screen.getByText("Busca y selecciona un usuario...");
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(
        screen.getByText("Juan Perez (juan@example.com)")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Test user (test@example.com)")
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByText("Juan Perez (juan@example.com)"));

    // Action multi-select is now visible
    await waitFor(() => {
      expect(
        screen.getByText("Selecciona las acciones permitidas...")
      ).toBeInTheDocument();
    });

    // Save button must remain disabled because user has 0 actions
    const saveBtn = screen.getByRole("button", { name: "Guardar" });
    expect(saveBtn).toBeDisabled();

    // Select an action
    const actionsTrigger = screen.getByText(
      "Selecciona las acciones permitidas..."
    );
    await user.click(actionsTrigger);

    await waitFor(() => {
      expect(screen.getByText("Crear Productos")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Crear Productos"));

    // Close actions dropdown by pressing escape or clicking outside
    await user.keyboard("{Escape}");

    // Now Save button is enabled
    await waitFor(() => {
      expect(saveBtn).toBeEnabled();
    });

    await user.click(saveBtn);

    expect(businessServices.assignCollaborators).toHaveBeenCalledWith("biz-1", {
      users: [
        {
          user_id: "user-1",
          position: undefined,
          action_ids: ["ba-1"],
        },
      ],
    });
  });
});
