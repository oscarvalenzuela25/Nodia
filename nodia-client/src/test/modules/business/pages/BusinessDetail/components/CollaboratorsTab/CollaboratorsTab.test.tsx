import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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


const mockMobile = () => vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
  matches: query.includes("599.95"), media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

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

    // The tab name already identifies the section.
    expect(screen.queryByText("Colaboradores del Negocio")).not.toBeInTheDocument();

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
    expect(within(screen.getByRole("table")).getByText("Activo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar filtro: Estado: Activo" })).toBeInTheDocument();

    // Second collaborator
    expect(screen.queryByText("Ana Gomez")).not.toBeInTheDocument();
    expect(screen.queryByText("ana@test.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin especificar")).not.toBeInTheDocument();
    expect(screen.queryByText("1 asignadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Inactivo")).not.toBeInTheDocument();
  });

  it("calls onOpenAddCollaborator when clicking toolbar button", async () => {
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
  it("filters by inactive status, clears to active and searches the complete collection", async () => {
    const user = userEvent.setup();
    renderWithClient(<CollaboratorsTab businessId="biz-1" collaborators={mockCollaborators} onOpenAddCollaborator={vi.fn()} />);
    expect(screen.queryByText("Ana Gomez")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    await user.click(screen.getByRole("button", { name: "Estado de actividad" }));
    await user.click(await screen.findByRole("option", { name: "Inactivo" }));
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    expect(screen.queryByText("Carlos Sanchez")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Abrir filtros" }));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(await screen.findByText("Carlos Sanchez")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Quitar filtro: Estado: Activo" }));
    await user.type(screen.getByRole("textbox", { name: /Buscar por nombre/ }), "ana@test.com");
    expect(await screen.findByText("Ana Gomez")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Carlos Sanchez")).not.toBeInTheDocument());
  });

  it("shows only active collaborators in mobile cards and preserves removal confirmation", async () => {
    mockMobile();
    const user = userEvent.setup();
    renderWithClient(<CollaboratorsTab businessId="biz-1" collaborators={mockCollaborators} onOpenAddCollaborator={vi.fn()} />);
    const card = screen.getByRole("article", { name: "Carlos Sanchez" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Ana Gomez")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /Acciones de/ }));
    await user.click(screen.getByRole("menuitem", { name: "Quitar colaborador" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Carlos Sanchez");
    expect(businessServices.assignCollaborators).not.toHaveBeenCalled();
  });

});
