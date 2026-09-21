import useAuthStore from "../../../../../store/authStore";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { sileo } from "sileo";
import Actions from "../../../../../modules/generalSettings/pages/Actions/Actions";
import * as services from "../../../../../modules/generalSettings/pages/Actions/infrastructure/services";
import type {
  Action,
  BusinessAction,
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
    getBusinessActions: vi.fn(),
    createBusinessAction: vi.fn(),
    updateBusinessAction: vi.fn(),
    deleteBusinessAction: vi.fn(),
  })
);

const mockActions: Action[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    key: "users.create",
    description: "Permite registrar nuevos usuarios",
    is_active: true,
    translates: [
      { key: "key", es: "Crear Usuarios", en: "Create Users" },
      {
        key: "comment",
        es: "Permite registrar nuevos usuarios",
        en: "Allows registering new users",
      },
    ],
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    key: "users.read",
    description: "Permite visualizar usuarios",
    is_active: true,
    translates: [
      { key: "key", es: "Ver Usuarios", en: "View Users" },
      {
        key: "comment",
        es: "Permite visualizar usuarios",
        en: "Allows viewing users",
      },
    ],
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174003",
    key: "roles.manage",
    description: "Permite gestionar roles",
    is_active: false,
    translates: [
      { key: "key", es: "Gestionar Roles", en: "Manage Roles" },
      {
        key: "comment",
        es: "Permite gestionar roles",
        en: "Allows managing roles",
      },
    ],
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

const mockBusinessActions: BusinessAction[] = [
  {
    id: "ba-1001",
    key: "orders.create",
    has_description: true,
    is_active: true,
    translates: [
      { key: "key", es: "Crear Pedido", en: "Create Order" },
      {
        key: "description",
        es: "Permite registrar nuevos pedidos",
        en: "Allows creating new orders",
      },
    ],
  },
];

const mockBusinessPaginatedResponse: PaginatedResponse<BusinessAction> = {
  data: mockBusinessActions,
  meta: {
    page: 1,
    limit: 10,
    total_items: 1,
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
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test user" },
    });
    vi.clearAllMocks();
    vi.mocked(services.getActions).mockResolvedValue(mockPaginatedResponse);
    vi.mocked(services.getBusinessActions).mockResolvedValue(
      mockBusinessPaginatedResponse
    );
  });

  it("renders actions table with expected columns and dual perspective switcher", async () => {
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
      expect(screen.getByText("orders.create")).toBeInTheDocument();
    });

    // Perspective switcher options
    expect(
      screen.getByRole("button", { name: /Vista Dividida/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Acciones del Sistema/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Acciones de Negocio/i })
    ).toBeInTheDocument();

    // Headers
    expect(screen.getAllByText("Id").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Nombre").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Identificador").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Descripción").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Activo").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Crear Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Crear Pedido")).toBeInTheDocument();
  });

  it("allows switching perspective modes between Split, System Only, and Business Only", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
      expect(screen.getByText("orders.create")).toBeInTheDocument();
    });

    // Switch to System Only
    const systemOnlyBtn = screen.getByRole("button", {
      name: "Acciones del Sistema",
    });
    await user.click(systemOnlyBtn);

    expect(screen.getByText("users.create")).toBeInTheDocument();
    expect(screen.queryByText("orders.create")).not.toBeInTheDocument();

    // Switch to Business Only
    const businessOnlyBtn = screen.getByRole("button", {
      name: "Acciones de Negocio",
    });
    await user.click(businessOnlyBtn);

    expect(screen.queryByText("users.create")).not.toBeInTheDocument();
    expect(screen.getByText("orders.create")).toBeInTheDocument();
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

    expect(writeTextMock).toHaveBeenCalled();
    expect(sileo.info).toHaveBeenCalledWith({
      title: "Copiar ID",
      description: "Copiado al portapapeles",
    });
  });

  it("opens create action modal when clicking 'Nuevo Accionable'", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
    });

    const newActionBtn = screen.getByRole("button", {
      name: /Nuevo Accionable/i,
    });
    await user.click(newActionBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Accionable" })
    ).toBeInTheDocument();
  });

  it("opens create business action modal when clicking 'Nueva Acción de Negocio'", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("orders.create")).toBeInTheDocument();
    });

    const newBusinessActionBtn = screen.getByRole("button", {
      name: /Nueva Acción de Negocio/i,
    });
    await user.click(newBusinessActionBtn);

    expect(
      screen.getAllByText("Nueva Acción de Negocio").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders actions menu with 'Actualizar' and opens edit modal with prefilled data", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    // actionButtons[1] corresponds to first system action (users.create)
    await user.click(actionButtons[1]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();
    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Accionable" })
    ).toBeInTheDocument();
  });

  it("opens ConfirmDialog and toggles action active status upon confirmation", async () => {
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
    await user.click(actionButtons[1]);

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
    vi.mocked(services.getBusinessActions).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });

    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(
        screen.getAllByText("No hay acciones disponibles").length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole("button", { name: "Crear primera acción" }).length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("opens filter modal with Translate (key) options in identifier select", async () => {
    const user = userEvent.setup();
    renderWithClient(<Actions />);

    await waitFor(() => {
      expect(screen.getByText("users.create")).toBeInTheDocument();
    });

    const filterBtn = screen.getByRole("button", { name: /Abrir filtros/i });
    await user.click(filterBtn);

    expect(screen.getByText("Filtros de acciones")).toBeInTheDocument();

    const selectTrigger = screen.getByText(/ej: users\.create, roles\.manage/i);
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(
        screen.getByText("Crear Usuarios (users.create)")
      ).toBeInTheDocument();
      expect(screen.getByText("Ver Usuarios (users.read)")).toBeInTheDocument();
    });
  });
});
