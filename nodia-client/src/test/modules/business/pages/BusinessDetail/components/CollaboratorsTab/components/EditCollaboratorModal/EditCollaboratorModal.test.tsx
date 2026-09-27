import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import EditCollaboratorModal from "../../../../../../../../../modules/business/pages/BusinessDetail/components/CollaboratorsTab/components/EditCollaboratorModal";
import * as actionServices from "../../../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services";
import * as businessServices from "../../../../../../../../../modules/business/infrastructure/services";
import type { BusinessCollaborator } from "../../../../../../../../../modules/business/infrastructure/types";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock(
  "../../../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services",
  () => ({
    getBusinessActions: vi.fn(),
  })
);

vi.mock(
  "../../../../../../../../../modules/business/infrastructure/services",
  () => ({
    assignCollaborators: vi.fn(),
  })
);

const mockBusinessActions = [
  {
    id: "act-1",
    key: "products.create",
    has_description: false,
    is_active: true,
    translates: [{ key: "key", es: "Crear Productos", en: "Create Products" }],
  },
  {
    id: "act-2",
    key: "orders.manage",
    has_description: false,
    is_active: true,
    translates: [{ key: "key", es: "Gestionar Pedidos", en: "Manage Orders" }],
  },
];

const mockCollaborator: BusinessCollaborator = {
  id: "collab-1",
  user_id: "user-101",
  position: "Jefe de Compras",
  action_ids: ["act-1"],
  is_active: true,
  user: {
    id: "user-101",
    name: "Carlos Sanchez",
    email: "carlos@test.com",
  },
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

describe("EditCollaboratorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actionServices.getBusinessActions).mockResolvedValue({
      data: mockBusinessActions,
      meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
    });
    vi.mocked(businessServices.assignCollaborators).mockResolvedValue([mockCollaborator]);
  });

  it("renders modal with collaborator name, email, position and actions", async () => {
    renderWithClient(
      <EditCollaboratorModal
        open={true}
        onClose={vi.fn()}
        businessId="biz-1"
        collaborator={mockCollaborator}
      />
    );

    expect(screen.getByText("Editar Colaborador")).toBeInTheDocument();
    expect(screen.getByText("Carlos Sanchez")).toBeInTheDocument();
    expect(screen.getByText("carlos@test.com")).toBeInTheDocument();

    const positionInput = screen.getByPlaceholderText(
      "Ej: Administrador de Tienda, Vendedor"
    );
    expect(positionInput).toHaveValue("Jefe de Compras");

    const saveBtn = screen.getByTestId("save-edit-collab-btn");
    expect(saveBtn).toBeEnabled();
  });

  it("submits updated position and actions for that single collaborator", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithClient(
      <EditCollaboratorModal
        open={true}
        onClose={handleClose}
        businessId="biz-1"
        collaborator={mockCollaborator}
      />
    );

    const positionInput = screen.getByPlaceholderText(
      "Ej: Administrador de Tienda, Vendedor"
    );
    await user.clear(positionInput);
    await user.type(positionInput, "Gerente de Operaciones");

    const saveBtn = screen.getByTestId("save-edit-collab-btn");
    await user.click(saveBtn);

    expect(businessServices.assignCollaborators).toHaveBeenCalledWith("biz-1", {
      users: [
        {
          user_id: "user-101",
          position: "Gerente de Operaciones",
          action_ids: ["act-1"],
        },
      ],
    });

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps modal open when assignCollaborators fails", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    vi.mocked(businessServices.assignCollaborators).mockRejectedValueOnce(
      new Error("Network Error")
    );

    renderWithClient(
      <EditCollaboratorModal
        open={true}
        onClose={handleClose}
        businessId="biz-1"
        collaborator={mockCollaborator}
      />
    );

    const saveBtn = screen.getByTestId("save-edit-collab-btn");
    await user.click(saveBtn);

    expect(businessServices.assignCollaborators).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByText("Editar Colaborador")).toBeInTheDocument();
  });
});
