import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { sileo } from "sileo";
import Actions from "../../../../../modules/generalSettings/pages/Actions/Actions";
import * as services from "../../../../../modules/generalSettings/pages/Actions/infrastructure/services";
import * as moduleServices from "../../../../../modules/generalSettings/pages/Modules/infrastructure/services";
import type {
  Action,
  PaginatedResponse,
} from "../../../../../modules/generalSettings/pages/Actions/types";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock(
  "../../../../../modules/generalSettings/pages/Actions/infrastructure/services",
  () => ({
    getActions: vi.fn(),
    createAction: vi.fn(),
    updateAction: vi.fn(),
  })
);

vi.mock(
  "../../../../../modules/generalSettings/pages/Modules/infrastructure/services",
  () => ({
    getModules: vi.fn(),
  })
);

const mockActions: Action[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    key: "users.create",
    description: "Permite registrar nuevos usuarios",
    is_active: true,
    module_id: "mod-users",
    module: {
      id: "mod-users",
      key: "users",
    },
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    key: "users.read",
    description: "Permite visualizar usuarios",
    is_active: true,
    module_id: "mod-users",
    module: {
      id: "mod-users",
      key: "users",
    },
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174003",
    key: "roles.manage",
    description: "Permite gestionar roles",
    is_active: false,
    module_id: null,
    module: null,
  },
];

const mockPaginatedResponse: PaginatedResponse<Action> = {
  data: mockActions,
  meta: {
    page: 1,
    limit: 10,
    total_items: 3,
    total_pages: 1,
  },
};

const mockModulesResponse = {
  data: [
    { id: "mod-parent", key: "settings", type: "module", parent_id: null },
    { id: "mod-sub", key: "general", type: "submodule", parent_id: "mod-parent" },
    { id: "mod-users", key: "users", type: "module", parent_id: null },
  ],
  meta: {
    page: 1,
    limit: 10,
    total_items: 3,
    total_pages: 1,
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

describe("Actions Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(services.getActions).mockResolvedValue(mockPaginatedResponse);
    vi.mocked(moduleServices.getModules).mockResolvedValue(mockModulesResponse as any);
  });

  it("renders actions table with expected columns (without Nombre column) and fetched actions", async () => {
    renderWithClient(<Actions />);

    expect(screen.getAllByText("Acciones").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText("Id")).toBeInTheDocument();
      expect(screen.getByText("Identificador")).toBeInTheDocument();
      expect(screen.getByText("Descripción")).toBeInTheDocument();
      expect(screen.getByText("Módulo asociado")).toBeInTheDocument();
      expect(screen.getByText("Activo")).toBeInTheDocument();

      // Ensure "Nombre" column was removed
      expect(screen.queryByText("Nombre")).not.toBeInTheDocument();

      // Verify action keys are present
      expect(screen.getByText("users.create")).toBeInTheDocument();
      expect(screen.getByText("users.read")).toBeInTheDocument();
      expect(screen.getByText("roles.manage")).toBeInTheDocument();
    });
  });

  it("fetches modules with all=true & includes=false for filter options", async () => {
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(moduleServices.getModules).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
    });
  });

  it("copies id to clipboard and triggers sileo info toast", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button", { name: "Copiar ID" });
    await user.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith(mockActions[0].id);
    expect(sileo.info).toHaveBeenCalledWith({
      title: "Copiar ID",
      description: "Copiado al portapapeles",
    });
  });

  it("opens create action modal when clicking 'Nuevo Accionable'", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    const newActionBtn = screen.getByRole("button", {
      name: /Nuevo Accionable/i,
    });
    await waitFor(() => {
      expect(newActionBtn).toBeEnabled();
    });
    await user.click(newActionBtn);

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Nuevo Accionable" })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Identificador")).toBeInTheDocument();
  });

  it("opens action menu with 'Actualizar' and opens edit modal with prefilled data", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Accionable" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users.create")).toBeInTheDocument();
  });

  it("allows toggling active status with ConfirmDialog and calling updateAction", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateAction).mockResolvedValue({
      ...mockActions[0],
      is_active: false,
    });

    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const deactivateOption = screen.getByRole("menuitem", {
      name: /Desactivar/i,
    });
    await user.click(deactivateOption);

    expect(screen.getByText("¿Desactivar acción?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Desactivar" });
    await user.click(confirmBtn);

    expect(services.updateAction).toHaveBeenCalledWith(mockActions[0].id, {
      is_active: false,
    });
  });

  it("renders empty state when no actions are returned", async () => {
    vi.mocked(services.getActions).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });

    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(
        screen.getByText("No hay acciones disponibles")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Crear primera acción" })
      ).toBeInTheDocument();
    });
  });
});
