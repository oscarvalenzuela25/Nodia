import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import Users from "../../../../../modules/generalSettings/pages/Users/Users";
import * as services from "../../../../../modules/generalSettings/pages/Users/infrastructure/services";
import * as rolesServices from "../../../../../modules/generalSettings/pages/Roles/infrastructure/services";
import * as modulesServices from "../../../../../modules/generalSettings/pages/Modules/infrastructure/services";
import type {
  PaginatedResponse,
  User,
} from "../../../../../modules/generalSettings/pages/Users/types";
import type { Role } from "../../../../../modules/generalSettings/pages/Roles/types";

vi.mock(
  "../../../../../modules/generalSettings/pages/Users/infrastructure/services",
  () => ({
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
  })
);

vi.mock(
  "../../../../../modules/generalSettings/pages/Roles/infrastructure/services",
  () => ({
    getRoles: vi.fn(),
  })
);

vi.mock(
  "../../../../../modules/generalSettings/pages/Modules/infrastructure/services",
  () => ({
    getModules: vi.fn(),
  })
);

const mockUsers: User[] = [
  {
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Juan Perez",
    email: "juan@example.com",
    image_url: null,
    is_active: true,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    roles: [
      {
        id: "r1",
        key: "admin",
        is_active: true,
      },
    ],
    modules: [
      {
        id: "m1",
        key: "settings",
        is_active: true,
        translates: [{ key: "key", es: "Ajustes", en: "Settings" }],
      },
    ],
  },
  {
    id: "123e4567-e89b-12d3-a456-426614174002",
    name: "Maria Lopez",
    email: "maria@example.com",
    image_url: null,
    is_active: false,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:00:00.000Z",
    roles: [
      {
        id: "r2",
        key: "manager",
        is_active: true,
      },
    ],
    modules: [],
  },
];

const mockPaginatedResponse: PaginatedResponse<User> = {
  data: mockUsers,
  meta: {
    page: 1,
    limit: 10,
    total_items: 2,
    total_pages: 1,
  },
};

const mockRolesResponse: PaginatedResponse<Role> = {
  data: [
    {
      id: "r1",
      key: "admin",
      is_active: true,
      translates: [{ key: "key", es: "Super Administrador", en: "Admin" }],
    },
    {
      id: "r2",
      key: "manager",
      is_active: true,
      translates: [{ key: "key", es: "Gerente", en: "Manager" }],
    },
  ],
  meta: {
    page: 1,
    limit: 10,
    total_items: 2,
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
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return {
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    ),
    queryClient,
  };
};

describe("Users Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rolesServices.getRoles).mockResolvedValue(mockRolesResponse);
    vi.mocked(modulesServices.getModules).mockResolvedValue({
      data: [{ id: "m1", key: "auth", group_by: "system", is_active: true }],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    });
  });

  it("renders users table with expected columns and data from getUsers (Endpoint 1)", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);

    renderWithClient(<Users />);

    expect(screen.getByText("Usuarios")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Id")).toBeInTheDocument();
      expect(screen.getByText("Nombre")).toBeInTheDocument();
      expect(screen.getByText("Correo Electrónico")).toBeInTheDocument();
      expect(screen.getByText("Roles")).toBeInTheDocument();
      expect(screen.getByText("Módulos")).toBeInTheDocument();
      expect(screen.getByText("Activo")).toBeInTheDocument();
      expect(screen.getByText("Acciones")).toBeInTheDocument();

      // Verify "Permitido" column is removed
      expect(screen.queryByText("Permitido")).not.toBeInTheDocument();

      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.getByText("juan@example.com")).toBeInTheDocument();
      expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
      expect(screen.getByText("maria@example.com")).toBeInTheDocument();
      expect(screen.getByText("Ajustes (settings)")).toBeInTheDocument();
      expect(screen.getByText("Super Administrador (admin)")).toBeInTheDocument();
    });

    expect(services.getUsers).toHaveBeenCalledWith({
      page: 1,
      size: 10,
      q: undefined,
    });
    expect(services.getUsers).toHaveBeenCalledWith({
      all: true,
      includes: false,
    });
    expect(rolesServices.getRoles).toHaveBeenCalledWith({
      all: true,
      includes: false,
    });
    expect(modulesServices.getModules).toHaveBeenCalledWith({
      all: true,
      includes: false,
    });
  });

  it("filters users using InputSearch by name", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);
    const user = userEvent.setup();

    renderWithClient(<Users />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Buscar por nombre...");
    await user.type(searchInput, "Maria");

    await waitFor(() => {
      expect(services.getUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.objectContaining({ name_cont: "Maria" }),
        })
      );
    });
  });

  it("renders empty state when no users are returned", async () => {
    vi.mocked(services.getUsers).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });

    renderWithClient(<Users />);

    await waitFor(() => {
      expect(
        screen.getByText("No hay usuarios disponibles")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Crear primer usuario" })
      ).toBeInTheDocument();
    });
  });

  it("renders error state when query fails and allows retry", async () => {
    vi.mocked(services.getUsers).mockImplementation(async (params) => {
      if (params?.page) {
        throw new Error("Network Error");
      }
      return mockPaginatedResponse;
    });

    renderWithClient(<Users />);

    await waitFor(() => {
      expect(
        screen.getByText("Error al cargar los usuarios")
      ).toBeInTheDocument();
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });

    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);
    const user = userEvent.setup();
    const retryBtn = screen.getByRole("button", { name: /Reintentar/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });
  });

  it("opens create user modal and creates a user via useCreateUser (Endpoint 2)", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);
    const createdUser: User = {
      id: "999",
      name: "Carlos Santana",
      email: "carlos@example.com",
      image_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      roles: [],
    };
    vi.mocked(services.createUser).mockResolvedValue(createdUser);

    const user = userEvent.setup();
    renderWithClient(<Users />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const newUserButton = screen.getByRole("button", {
      name: /Nuevo usuario/i,
    });
    await user.click(newUserButton);

    expect(screen.getByText("Nuevo Usuario")).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText("correo@ejemplo.com");
    await user.type(emailInput, "carlos@example.com");

    const nameInput = screen.getByPlaceholderText("Ingresa el nombre");
    await user.type(nameInput, "Carlos Santana");

    const submitBtn = screen.getByRole("button", { name: "Crear Usuario" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "carlos@example.com",
          name: "Carlos Santana",
          is_active: true,
        })
      );
    });
  });

  it("opens action menu with 'Actualizar' and updates user via useUpdateUser (Endpoint 3)", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);
    vi.mocked(services.updateUser).mockResolvedValue({
      ...mockUsers[0],
      name: "Juan Perez Editado",
    });

    const user = userEvent.setup();
    renderWithClient(<Users />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Usuario" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Juan Perez")).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Juan Perez");
    await user.clear(nameInput);
    await user.type(nameInput, "Juan Perez Editado");

    const updateBtn = screen.getByRole("button", { name: "Actualizar Usuario" });
    await user.click(updateBtn);

    await waitFor(() => {
      expect(services.updateUser).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        expect.objectContaining({
          name: "Juan Perez Editado",
        })
      );
    });
  });

  it("opens ConfirmDialog and toggles user active status upon confirmation", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);
    vi.mocked(services.updateUser).mockResolvedValue({
      ...mockUsers[0],
      is_active: false,
    });

    const user = userEvent.setup();
    renderWithClient(<Users />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
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
      screen.getByRole("heading", { name: "¿Desactivar usuario?" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/¿Está seguro de que desea desactivar al usuario Juan Perez\?/i)
    ).toBeInTheDocument();

    // Confirm action
    const confirmBtn = screen.getByRole("button", { name: "Confirmar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateUser).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        expect.objectContaining({
          is_active: false,
        })
      );
    });
  });

  it("cancels toggling user active status when clicking Cancelar in ConfirmDialog", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);

    const user = userEvent.setup();
    renderWithClient(<Users />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    const actionButtons = screen.getAllByRole("button", { name: "Acciones" });
    await user.click(actionButtons[0]);

    const deactivateOption = screen.getByRole("menuitem", {
      name: /Desactivar/i,
    });
    await user.click(deactivateOption);

    expect(
      screen.getByRole("heading", { name: "¿Desactivar usuario?" })
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "¿Desactivar usuario?" })
      ).not.toBeInTheDocument();
    });

    expect(services.updateUser).not.toHaveBeenCalled();
  });

  it("fetches filter options with all=true & includes=false and renders Filter modal with Translate (key) options", async () => {
    vi.mocked(services.getUsers).mockResolvedValue(mockPaginatedResponse);
    vi.mocked(rolesServices.getRoles).mockResolvedValue(mockRolesResponse);
    vi.mocked(modulesServices.getModules).mockResolvedValue({
      data: [
        {
          id: "m1",
          key: "settings",
          group_by: "system",
          is_active: true,
          translates: [{ key: "key", es: "Ajustes", en: "Settings" }],
        },
      ],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    });

    const user = userEvent.setup();
    renderWithClient(<Users />);

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    });

    expect(services.getUsers).toHaveBeenCalledWith({
      all: true,
      includes: false,
    });
    expect(rolesServices.getRoles).toHaveBeenCalledWith({
      all: true,
      includes: false,
    });
    expect(modulesServices.getModules).toHaveBeenCalledWith({
      all: true,
      includes: false,
    });

    const filterButton = screen.getByRole("button", { name: /Filtros/i });
    await user.click(filterButton);

    expect(screen.getByText("Filtros de usuarios")).toBeInTheDocument();
    expect(screen.getAllByText("Roles").length).toBeGreaterThanOrEqual(2);

    // Click module filter input to open popover
    const moduleInput = screen.getByText("Seleccionar módulos...");
    await user.click(moduleInput);

    // Verify option is rendered with Translate (key)
    await waitFor(() => {
      expect(
        screen.getAllByText("Ajustes (settings)").length
      ).toBeGreaterThanOrEqual(2);
    });

    // Click roles filter input to open popover
    const roleInput = screen.getByText("Seleccionar roles...");
    await user.click(roleInput);

    // Verify role option is rendered with Translate (key)
    await waitFor(() => {
      expect(
        screen.getAllByText("Super Administrador (admin)").length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
