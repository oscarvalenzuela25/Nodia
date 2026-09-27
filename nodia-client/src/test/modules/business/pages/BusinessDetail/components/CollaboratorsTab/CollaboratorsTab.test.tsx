import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { CollaboratorsTab } from "../../../../../../../modules/business/pages/BusinessDetail/components/CollaboratorsTab/CollaboratorsTab";
import type { BusinessCollaborator } from "../../../../../../../modules/business/infrastructure/types";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import * as actionServices from "../../../../../../../modules/generalSettings/pages/Actions/infrastructure/services";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

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

const mockCollaborators: BusinessCollaborator[] = [
  {
    id: "collab-1",
    user_id: "101",
    position: "Jefe de Compras",
    action_ids: ["act-1", "act-2"],
    is_active: true,
    user: {
      id: "101",
      name: "Carlos Sanchez",
      email: "carlos@test.com",
    },
  },
  {
    id: "collab-2",
    user_id: "102",
    position: null,
    action_ids: ["act-3"],
    is_active: false,
    user: {
      id: "102",
      name: "Ana Gomez",
      email: "ana@test.com",
    },
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

describe("CollaboratorsTab Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actionServices.getBusinessActions).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 1 },
    });
    vi.mocked(businessServices.assignCollaborators).mockResolvedValue([]);
  });

  it("renders empty state when there are no collaborators", () => {
    const onOpenAdd = vi.fn();
    renderWithClient(
      <CollaboratorsTab
        businessId="biz-1"
        collaborators={[]}
        onOpenAddCollaborator={onOpenAdd}
      />
    );

    expect(
      screen.getByText("Aún no se han configurado colaboradores para este negocio.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Agregar colaborador" })
    ).toBeInTheDocument();
  });

  it("renders table with collaborator list including avatars, names, positions, action chips, and status", () => {
    const onOpenAdd = vi.fn();
    renderWithClient(
      <CollaboratorsTab
        businessId="biz-1"
        collaborators={mockCollaborators}
        onOpenAddCollaborator={onOpenAdd}
      />
    );

    // Header title and add button
    expect(screen.getByText("Colaboradores del Negocio")).toBeInTheDocument();

    // Table column headers
    expect(screen.getByText("Colaborador / Usuario")).toBeInTheDocument();
    expect(screen.getByText("Cargo / Posición")).toBeInTheDocument();
    expect(screen.getByText("Acciones Asignadas")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();

    // First collaborator
    expect(screen.getByText("Carlos Sanchez")).toBeInTheDocument();
    expect(screen.getByText("carlos@test.com")).toBeInTheDocument();
    expect(screen.getByText("Jefe de Compras")).toBeInTheDocument();
    expect(screen.getByText("2 asignadas")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();

    // Second collaborator
    expect(screen.getByText("Ana Gomez")).toBeInTheDocument();
    expect(screen.getByText("ana@test.com")).toBeInTheDocument();
    expect(screen.getByText("Sin especificar")).toBeInTheDocument();
    expect(screen.getByText("1 asignadas")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("calls onOpenAddCollaborator when clicking header button", async () => {
    const user = userEvent.setup();
    const onOpenAdd = vi.fn();
    renderWithClient(
      <CollaboratorsTab
        businessId="biz-1"
        collaborators={mockCollaborators}
        onOpenAddCollaborator={onOpenAdd}
      />
    );

    const headerAddBtn = screen.getByTestId("add-collab-tab-btn");
    await user.click(headerAddBtn);
    expect(onOpenAdd).toHaveBeenCalledTimes(1);
  });

  it("opens 3-dots action menu and allows opening edit modal", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <CollaboratorsTab
        businessId="biz-1"
        collaborators={mockCollaborators}
        onOpenAddCollaborator={vi.fn()}
      />
    );

    const actionBtn = screen.getByTestId("collab-actions-btn-collab-1");
    await user.click(actionBtn);

    const editMenuItem = screen.getByTestId("menu-item-edit-collab");
    const removeMenuItem = screen.getByTestId("menu-item-remove-collab");

    expect(editMenuItem).toBeInTheDocument();
    expect(removeMenuItem).toBeInTheDocument();

    await user.click(editMenuItem);

    // Edit modal opens
    expect(screen.getByText("Editar Colaborador")).toBeInTheDocument();
    expect(screen.getAllByText("Carlos Sanchez").length).toBeGreaterThanOrEqual(1);
  });

  it("opens ConfirmDialog and removes collaborator when clicking remove option", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <CollaboratorsTab
        businessId="biz-1"
        collaborators={mockCollaborators}
        onOpenAddCollaborator={vi.fn()}
      />
    );

    const actionBtn = screen.getByTestId("collab-actions-btn-collab-1");
    await user.click(actionBtn);

    const removeMenuItem = screen.getByTestId("menu-item-remove-collab");
    await user.click(removeMenuItem);

    // Confirm dialog is displayed
    expect(screen.getByText("¿Quitar colaborador?")).toBeInTheDocument();
    expect(
      screen.getByText(
        '¿Estás seguro de que deseas quitar a "Carlos Sanchez" como colaborador de este negocio?'
      )
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Quitar colaborador" });
    await user.click(confirmBtn);

    expect(businessServices.assignCollaborators).toHaveBeenCalledWith("biz-1", {
      users: [
        {
          user_id: "101",
          action_ids: [],
        },
      ],
    });
  });
});
