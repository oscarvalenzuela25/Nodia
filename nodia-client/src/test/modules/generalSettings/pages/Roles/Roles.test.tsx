import useAuthStore from "../../../../../store/authStore";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { sileo } from "sileo";
import Roles from "../../../../../modules/generalSettings/pages/Roles/Roles";
import * as services from "../../../../../modules/generalSettings/pages/Roles/infrastructure/services";
import * as actionServices from "../../../../../modules/generalSettings/pages/Actions/infrastructure/services";
import type {
  PaginatedResponse,
  Role,
} from "../../../../../modules/generalSettings/pages/Roles/types";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock(
  "../../../../../modules/generalSettings/pages/Roles/infrastructure/services",
  () => ({
    getRoles: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
  }),
);

vi.mock(
  "../../../../../modules/generalSettings/pages/Actions/infrastructure/services",
  () => ({
    getActions: vi.fn(),
  }),
);

const mockRoles: Role[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174001",
    key: "admin",
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Super Administrador",
        en: "Super Administrator",
      },
    ],
    nameTranslations: {
      es: "Super Administrador",
      en: "Super Administrator",
    },
    actions: [
      "users.create",
      "users.read",
      "users.update",
      "users.delete",
      "roles.manage",
      "reports.view",
      "settings.edit",
      "audit.logs",
    ],
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    key: "manager",
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Gerente de Operaciones",
        en: "Operations Manager",
      },
    ],
    nameTranslations: {
      es: "Gerente de Operaciones",
      en: "Operations Manager",
    },
    actions: ["users.read", "users.update", "reports.view", "settings.edit"],
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174003",
    key: "editor",
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Editor de Recursos",
        en: "Resource Editor",
      },
    ],
    nameTranslations: {
      es: "Editor de Recursos",
      en: "Resource Editor",
    },
    actions: ["users.read", "reports.view"],
  },
];

const mockPaginatedResponse: PaginatedResponse<Role> = {
  data: mockRoles,
  meta: {
    page: 1,
    limit: 10,
    total_items: 3,
    total_pages: 1,
  },
};

const mockActionsResponse = {
  data: [
    {
      id: "act-1",
      key: "users.create",
      is_active: true,
      translates: [{ key: "key", es: "Crear Usuarios", en: "Create Users" }],
    },
    {
      id: "act-2",
      key: "users.read",
      is_active: true,
      translates: [{ key: "key", es: "Ver Usuarios", en: "View Users" }],
    },
    {
      id: "act-3",
      key: "users.update",
      is_active: true,
      translates: [{ key: "key", es: "Editar Usuarios", en: "Edit Users" }],
    },
    {
      id: "act-4",
      key: "users.delete",
      is_active: true,
      translates: [{ key: "key", es: "Eliminar Usuarios", en: "Delete Users" }],
    },
    {
      id: "act-5",
      key: "roles.manage",
      is_active: true,
      translates: [{ key: "key", es: "Gestionar Roles", en: "Manage Roles" }],
    },
    {
      id: "act-6",
      key: "reports.view",
      is_active: true,
      translates: [{ key: "key", es: "Ver Reportes", en: "View Reports" }],
    },
    {
      id: "act-7",
      key: "settings.edit",
      is_active: true,
      translates: [
        { key: "key", es: "Configuración General", en: "General Settings" },
      ],
    },
    {
      id: "act-8",
      key: "audit.logs",
      is_active: true,
      translates: [{ key: "key", es: "Auditoría y Logs", en: "Audit & Logs" }],
    },
  ],
  meta: {
    page: 1,
    limit: 10,
    total_items: 8,
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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

const mobile = () =>
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("599.95"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

afterEach(() => vi.restoreAllMocks());

describe("Roles Page", () => {
  beforeEach(() => {
    useAuthStore
      .getState()
      .login({
        token: "test-jwt",
        expiresAt: Date.now() + 900_000,
        user: { id: "42", name: "Test user" },
      });
    vi.clearAllMocks();
    Object.values(services).forEach((service) =>
      vi.mocked(service).mockReset(),
    );
    vi.mocked(services.getRoles).mockResolvedValue(mockPaginatedResponse);
    vi.mocked(actionServices.getActions).mockResolvedValue(mockActionsResponse);
  });

  it("renders roles table with expected columns and initial dummy roles", async () => {
    renderWithClient(<Roles />);

    expect(screen.getByText("Roles")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Id")).toBeInTheDocument();
      expect(screen.getByText("Nombre")).toBeInTheDocument();
      expect(screen.getByText("Identificador")).toBeInTheDocument();
      expect(screen.getByText("Acciones asociadas")).toBeInTheDocument();
      expect(screen.getByText("Activo")).toBeInTheDocument();
      expect(screen.getByText("Acciones")).toBeInTheDocument();

      expect(screen.getByText("Super Administrador")).toBeInTheDocument();
      expect(screen.getByText("admin")).toBeInTheDocument();
      expect(screen.getByText("manager")).toBeInTheDocument();
      expect(screen.getByText("editor")).toBeInTheDocument();
    });
  });

  it("fetches actions and roles with all=true & includes=false for filter options", async () => {
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(services.getRoles).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
      expect(actionServices.getActions).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
    });
  });

  it("filters roles using InputSearch by identifier", async () => {
    const user = userEvent.setup();
    vi.mocked(services.getRoles).mockImplementation(async (params) => ({
      ...mockPaginatedResponse,
      data: params?.q?.key_cont
        ? mockRoles.filter((role) =>
            role.key.includes(String(params.q?.key_cont)),
          )
        : mockRoles,
    }));
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Buscar por identificador...",
    );

    await user.type(searchInput, "editor");

    await waitFor(() => {
      expect(screen.getByText("editor")).toBeInTheDocument();
      expect(screen.queryByText("admin")).not.toBeInTheDocument();
    });
  });

  it("opens create role modal when clicking 'Nuevo Rol'", async () => {
    const user = userEvent.setup();
    renderWithClient(<Roles />);

    const newRoleButton = screen.getByRole("button", { name: /Nuevo Rol/i });
    await waitFor(() => {
      expect(newRoleButton).toBeEnabled();
    });
    await user.click(newRoleButton);

    expect(
      screen.getByRole("heading", { name: "Nuevo Rol" }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/super_admin/i)).toBeInTheDocument();
  });

  it("opens action menu with 'Actualizar' and opens edit modal with prefilled data", async () => {
    const user = userEvent.setup();
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Rol" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin")).toBeInTheDocument();
  });

  it("copies role id to clipboard and displays sileo toast", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button", { name: "Copiar ID" });
    await user.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith(mockRoles[0].id);
    expect(sileo.info).toHaveBeenCalledWith({
      title: "Copiar ID",
      description: "Copiado al portapapeles",
    });
  });

  it("opens ConfirmDialog and toggles role active status upon confirmation", async () => {
    vi.mocked(services.updateRole).mockResolvedValue({
      ...mockRoles[0],
      is_active: false,
    });

    const user = userEvent.setup();
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const deactivateOption = screen.getByRole("menuitem", {
      name: /Desactivar/i,
    });
    expect(deactivateOption).toBeInTheDocument();

    await user.click(deactivateOption);

    // ConfirmDialog should be open
    expect(
      screen.getByRole("heading", { name: "¿Desactivar rol?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /¿Está seguro de que desea desactivar el rol "admin"\?/i,
      ),
    ).toBeInTheDocument();

    // Confirm action
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateRole).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174001",
        expect.objectContaining({
          is_active: false,
        }),
      );
    });
  });

  it("cancels toggling role active status when clicking Cancelar in ConfirmDialog", async () => {
    const user = userEvent.setup();
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const deactivateOption = screen.getByRole("menuitem", {
      name: /Desactivar/i,
    });
    await user.click(deactivateOption);

    expect(
      screen.getByRole("heading", { name: "¿Desactivar rol?" }),
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "¿Desactivar rol?" }),
      ).not.toBeInTheDocument();
    });

    expect(services.updateRole).not.toHaveBeenCalled();
  });

  it("renders empty state when server returns empty roles list", async () => {
    vi.mocked(services.getRoles).mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        limit: 10,
        total_items: 0,
        total_pages: 0,
      },
    });

    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("No hay roles disponibles")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Crear primer rol/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders error state when fetch fails and allows retry", async () => {
    vi.mocked(services.getRoles).mockImplementation(async (params) => {
      if (params?.page) {
        throw new Error("Network Error");
      }
      return mockPaginatedResponse;
    });

    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("Error al cargar los roles")).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /Reintentar/i });
    expect(retryButton).toBeInTheDocument();
  });

  it("opens create role modal and creates a role via createRole", async () => {
    const createdRole: Role = {
      id: "new-role-999",
      key: "custom_operator",
      is_active: true,
      actions: ["users.read"],
    };
    vi.mocked(services.createRole).mockResolvedValue(createdRole);

    const user = userEvent.setup();
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const newRoleButton = screen.getByRole("button", { name: /Nuevo Rol/i });
    await user.click(newRoleButton);

    expect(
      screen.getByRole("heading", { name: "Nuevo Rol" }),
    ).toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText(
      "ej: super_admin, editor, gestor",
    );
    await user.type(keyInput, "custom_operator");

    const submitBtn = screen.getByRole("button", { name: "Crear Rol" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createRole).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "custom_operator",
          is_active: true,
        }),
      );
    });
  });

  it("opens action menu with 'Actualizar' and updates role via updateRole", async () => {
    vi.mocked(services.updateRole).mockResolvedValue({
      ...mockRoles[0],
      key: "admin_updated",
    });

    const user = userEvent.setup();
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Rol" }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", { name: "Actualizar Rol" });
    await user.click(updateBtn);

    await waitFor(() => {
      expect(services.updateRole).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174001",
        expect.objectContaining({
          key: "admin",
          is_active: true,
        }),
      );
    });
  });

  it("opens filter modal with Translate (key) options for identifier and actions", async () => {
    const user = userEvent.setup();
    renderWithClient(<Roles />);

    await waitFor(() => {
      expect(screen.getByText("admin")).toBeInTheDocument();
    });

    const filterButton = screen.getByRole("button", { name: /Abrir filtros/i });
    await user.click(filterButton);

    expect(screen.getByText("Filtros de roles")).toBeInTheDocument();

    // Verify role key select has Translate (key) options
    const roleKeyTrigger = screen.getByText(/ej: super_admin, editor, gestor/i);
    await user.click(roleKeyTrigger);

    await waitFor(() => {
      expect(
        screen.getByText("Super Administrador (admin)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Gerente de Operaciones (manager)"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Editor de Recursos (editor)"),
      ).toBeInTheDocument();
    });

    // Close role dropdown
    await user.keyboard("{Escape}");

    // Verify actions select has Translate (key) options
    const actionsTrigger = screen.getByText(
      /Seleccionar acciones permitidas\.\.\./i,
    );
    await user.click(actionsTrigger);

    await waitFor(() => {
      expect(
        screen.getByText("Crear Usuarios (users.create)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Ver Usuarios (users.read)")).toBeInTheDocument();
    });
  });

  it("queries active roles by default, permits all by removing the chip, and restores active on Clear", async () => {
    const user = userEvent.setup();
    renderWithClient(<Roles />);
    await screen.findByText("admin");
    expect(services.getRoles).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, q: { is_active_eq: true } }),
    );
    await user.click(
      screen.getByRole("button", { name: "Quitar filtro: Solo activos" }),
    );
    await waitFor(() =>
      expect(services.getRoles).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, q: undefined }),
      ),
    );
    await user.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Quitar filtro: Solo activos" }),
      ).toBeVisible(),
    );
  });

  it("sends role and action filters to the server instead of filtering only the fetched page", async () => {
    const user = userEvent.setup();
    renderWithClient(<Roles />);
    await screen.findByText("admin");
    await user.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    await user.click(screen.getByText(/ej: super_admin, editor, gestor/i));
    await user.click(await screen.findByText("Editor de Recursos (editor)"));
    await user.keyboard("{Escape}");
    await user.click(screen.getByText(/Seleccionar acciones permitidas/i));
    await user.click(await screen.findByText("Ver Usuarios (users.read)"));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() =>
      expect(services.getRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          q: {
            key_in: ["editor"],
            actions_key_in: ["users.read"],
            is_active_eq: true,
          },
        }),
      ),
    );
  });

  it("confirms deletion, cancels, and retains the exact target after server failure for retry", async () => {
    const role = { ...mockRoles[0], id: "9007199254740993" };
    vi.mocked(services.getRoles).mockResolvedValue({
      ...mockPaginatedResponse,
      data: [role],
    });
    vi.mocked(services.deleteRole)
      .mockRejectedValueOnce({
        response: { data: { message: "roles:not_found" } },
      })
      .mockResolvedValueOnce(undefined);
    const client = createTestQueryClient(),
      invalidate = vi.spyOn(client, "invalidateQueries");
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client}>
        <Roles />
      </QueryClientProvider>,
    );
    await screen.findByText("admin");
    await user.click(screen.getByRole("button", { name: "Acciones" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    let dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      "asignaciones a usuarios, acciones y traducciones",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(services.deleteRole).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Acciones" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(sileo.error).toHaveBeenCalledWith(
        expect.objectContaining({ description: "El rol ya no existe." }),
      ),
    );
    expect(dialog).toHaveTextContent("Super Administrador");
    expect(
      within(dialog).getByRole("button", { name: "Eliminar" }),
    ).toBeEnabled();
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(services.deleteRole).toHaveBeenNthCalledWith(2, "9007199254740993");
    for (const queryKey of [["roles"], ["users"], ["authorization"]])
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Rol eliminado correctamente" }),
    );
  });

  it("hides deletion for the reserved key on desktop, even when inactive", async () => {
    vi.mocked(services.getRoles).mockResolvedValue({
      ...mockPaginatedResponse,
      data: [{ id: "7", key: "super_admin", is_active: false }],
    });
    const user = userEvent.setup();
    renderWithClient(<Roles />);
    await screen.findAllByText("super_admin");
    await user.click(screen.getByRole("button", { name: "Acciones" }));
    expect(
      screen.queryByRole("menuitem", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    expect(services.deleteRole).not.toHaveBeenCalled();
  });

  it("renders full mobile data and preserves reserved-key translations while locking its identifier", async () => {
    mobile();
    vi.mocked(services.getRoles).mockResolvedValue({
      ...mockPaginatedResponse,
      data: [
        {
          id: "9007199254740993",
          key: "super_admin",
          is_active: true,
          actions: mockRoles[0].actions,
        },
      ],
    });
    const user = userEvent.setup();
    renderWithClient(<Roles />);
    const card = await screen.findByRole("article", { name: "super_admin" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(card).getByText("9007199254740993")).toBeVisible();
    expect(within(card).getByText("Auditoría y Logs")).toBeVisible();
    await user.click(
      within(card).getByRole("button", { name: "Acciones de super_admin" }),
    );
    expect(
      screen.queryByRole("menuitem", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(card).getByRole("button", { name: "Actualizar" }));
    expect(screen.getByDisplayValue("super_admin")).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "esEspañol" })).toBeEnabled();
  });

  it("keeps cards visible and blocks controls while the next page is being fetched", async () => {
    mobile();
    let resolve!: (value: PaginatedResponse<Role>) => void;
    vi.mocked(services.getRoles).mockImplementation(async (params) =>
      params?.page === 2
        ? new Promise((done) => {
            resolve = done;
          })
        : {
            ...mockPaginatedResponse,
            meta: { page: 1, limit: 10, total_items: 11, total_pages: 2 },
          },
    );
    const user = userEvent.setup();
    renderWithClient(<Roles />);
    const card = await screen.findByRole("article", {
      name: "Super Administrador",
    });
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(card).toBeVisible();
    expect(
      within(card).getByRole("button", { name: "Actualizar" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Quitar filtro: Solo activos" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", {
        name: "Buscar por identificador...",
      }),
    ).toBeDisabled();
    await act(async () =>
      resolve({
        ...mockPaginatedResponse,
        data: [mockRoles[1]],
        meta: { page: 2, limit: 10, total_items: 11, total_pages: 2 },
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Super Administrador" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("returns to the preceding page after its last mobile role is deleted", async () => {
    mobile();
    let deleted = false;
    vi.mocked(services.deleteRole).mockImplementation(async () => {
      deleted = true;
    });
    vi.mocked(services.getRoles).mockImplementation(async (params) => ({
      data:
        params?.page === 2 ? (deleted ? [] : [mockRoles[1]]) : [mockRoles[0]],
      meta: {
        page: params?.page ?? 1,
        limit: 10,
        total_items: deleted ? 10 : 11,
        total_pages: deleted ? 1 : 2,
      },
    }));
    const user = userEvent.setup();
    renderWithClient(<Roles />);
    await screen.findByRole("article", { name: "Super Administrador" });
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    const card = await screen.findByRole("article", {
      name: "Gerente de Operaciones",
    });
    await user.click(
      within(card).getByRole("button", {
        name: "Acciones de Gerente de Operaciones",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Eliminar",
      }),
    );
    await screen.findByRole("article", { name: "Super Administrador" });
    expect(
      screen.getByRole("button", { name: "Página anterior" }),
    ).toBeDisabled();
  });

  it("shows a failed mobile query as an error rather than an empty successful list", async () => {
    mobile();
    vi.mocked(services.getRoles).mockImplementation(async (params) => {
      if (params?.page) throw new Error("Synthetic outage");
      return mockPaginatedResponse;
    });
    renderWithClient(<Roles />);
    await screen.findByRole("alert");
    expect(
      screen.queryByText("No hay roles disponibles"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});
