import useAuthStore from "../../../../../store/authStore";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { sileo } from "sileo";
import Modules from "../../../../../modules/generalSettings/pages/Modules/Modules";
import * as services from "../../../../../modules/generalSettings/pages/Modules/infrastructure/services";
import type {
  ModuleEntity,
  ModuleGroupEntity,
  PaginatedResponse,
} from "../../../../../modules/generalSettings/pages/Modules/types";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock(
  "../../../../../modules/generalSettings/pages/Modules/infrastructure/services",
  () => ({
    getModules: vi.fn(),
    createModule: vi.fn(),
    updateModule: vi.fn(),
    getModuleGroups: vi.fn(),
    createModuleGroup: vi.fn(),
    updateModuleGroup: vi.fn(),
  })
);

const mockGroups: ModuleGroupEntity[] = [
  {
    id: "mg1",
    key: "administration",
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Administración",
        en: "Administration",
      },
    ],
  },
  {
    id: "mg2",
    key: "reports",
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Reportes",
        en: "Reports",
      },
    ],
  },
];

const mockModules: ModuleEntity[] = [
  {
    id: "m1",
    key: "users",
    link: "/settings/users",
    module_group_id: "mg1",
    module_group: mockGroups[0],
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Usuarios",
        en: "Users",
      },
    ],
  },
  {
    id: "m2",
    key: "roles",
    link: "/settings/roles",
    module_group_id: "mg1",
    module_group: mockGroups[0],
    is_active: true,
    translates: [
      {
        key: "key",
        es: "Roles",
        en: "Roles",
      },
    ],
  },
  {
    id: "m3",
    key: "untranslated_feature",
    link: "/reports/untranslated",
    module_group_id: "mg2",
    module_group: mockGroups[1],
    is_active: false,
  },
];

const mockModulesPaginated: PaginatedResponse<ModuleEntity> = {
  data: mockModules,
  meta: {
    page: 1,
    limit: 10,
    total_items: mockModules.length,
    total_pages: 1,
  },
};

const mockGroupsPaginated: PaginatedResponse<ModuleGroupEntity> = {
  data: mockGroups,
  meta: {
    page: 1,
    limit: 5,
    total_items: mockGroups.length,
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

describe("Modules Page", () => {
  beforeEach(() => {
    useAuthStore.getState().login({ token: "test-jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Test user" } });
    vi.clearAllMocks();
    vi.mocked(services.getModules).mockResolvedValue(mockModulesPaginated);
    vi.mocked(services.getModuleGroups).mockResolvedValue(mockGroupsPaginated);
  });

  it("renders dual view with both tables, perspective switcher, and expected columns", async () => {
    renderWithClient(<Modules />);

    expect(screen.getAllByText("Módulos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();

    // Perspective switcher options
    expect(screen.getByRole("button", { name: /Vista Conjunta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Solo Módulos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Solo Grupos/i })).toBeInTheDocument();

    await waitFor(() => {
      // Module table headers
      expect(screen.getByText("Ruta")).toBeInTheDocument();
      expect(screen.getByText("Nombre de Grupo")).toBeInTheDocument();
      expect(screen.getByText("Identificador Grupal")).toBeInTheDocument();

      // Module group table header
      expect(screen.getByText("Nombre del Grupo")).toBeInTheDocument();

      // Table data
      expect(screen.getByText("users")).toBeInTheDocument();
      expect(screen.getByText("Usuarios")).toBeInTheDocument();
      expect(screen.getAllByText("Administración").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("administration").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("allows switching perspective modes between Split, Modules Only, and Groups Only", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
      expect(screen.getByText("Nombre de Grupo")).toBeInTheDocument();
    });

    // Switch to "Solo Módulos"
    const modulesOnlyBtn = screen.getByRole("button", { name: /Solo Módulos/i });
    await user.click(modulesOnlyBtn);

    expect(screen.queryByText("Grupos de Módulos")).not.toBeInTheDocument();
    expect(screen.getByText("Nombre de Grupo")).toBeInTheDocument();

    // Switch to "Solo Grupos"
    const groupsOnlyBtn = screen.getByRole("button", { name: /Solo Grupos/i });
    await user.click(groupsOnlyBtn);

    expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
    expect(screen.queryByText("Nombre de Grupo")).not.toBeInTheDocument();

    // Switch back to "Vista Conjunta"
    const splitBtn = screen.getByRole("button", { name: /Vista Conjunta/i });
    await user.click(splitBtn);

    expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
    expect(screen.getByText("Nombre de Grupo")).toBeInTheDocument();
  });

  it("fetches modules and groups with appropriate parameters", async () => {
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(services.getModules).toHaveBeenCalledWith({
        all: true,
        includes: false,
      });
      expect(services.getModules).toHaveBeenCalledWith({
        page: 1,
        size: 10,
        includes: true,
        q: undefined,
      });
      expect(services.getModuleGroups).toHaveBeenCalledWith({
        all: true,
      });
      expect(services.getModuleGroups).toHaveBeenCalledWith({
        page: 1,
        limit: 5,
        q: undefined,
      });
    });
  });

  it("filters modules using InputSearch with key_cont", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Buscar por identificador..."
    );

    await user.type(searchInput, "roles");

    await waitFor(() => {
      expect(services.getModules).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.objectContaining({
            key_cont: "roles",
          }),
        })
      );
    });
  });

  it("filters groups using InputSearch in the groups deck", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
      expect(
        screen.getAllByText("administration").length
      ).toBeGreaterThanOrEqual(1);
    });

    const searchGroupInput = screen.getByPlaceholderText(
      /Buscar por nombre o identificador de grupo/i
    );

    await user.type(searchGroupInput, "admin");

    await waitFor(() => {
      expect(services.getModuleGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.objectContaining({
            key_cont: "admin",
          }),
        })
      );
    });
  });

  it("creates a new module group via ModuleGroupModal", async () => {
    const user = userEvent.setup();
    vi.mocked(services.createModuleGroup).mockResolvedValue({
      id: "mg3",
      key: "finance",
      is_active: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
    });

    const newGroupBtn = screen.getByRole("button", {
      name: /Nuevo Grupo/i,
    });
    await user.click(newGroupBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Grupo de Módulos" })
    ).toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText(/users, roles, settings/i);
    await user.type(keyInput, "finance");

    const submitBtn = screen.getByRole("button", { name: "Crear Grupo" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createModuleGroup).toHaveBeenCalledWith({
        key: "finance",
        icon: null,
        is_active: true,
        translates: [
          {
            key: "key",
            es: "finance",
            en: "finance",
          },
        ],
      });
    });
  });

  it("deactivates an active module group via confirm dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModuleGroup).mockResolvedValue({
      id: "mg1",
      key: "administration",
      is_active: false,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
      expect(
        screen.getAllByText("administration").length
      ).toBeGreaterThanOrEqual(1);
    });

    const adminGroupRow = screen
      .getAllByText("administration")[0]
      .closest("tr")!;
    const actionBtn = within(adminGroupRow).getByRole("button", {
      name: "Acciones",
    });
    await user.click(actionBtn);

    const deactivateOption = screen.getByRole("menuitem", {
      name: /Desactivar/i,
    });
    await user.click(deactivateOption);

    expect(
      screen.getByRole("heading", { name: "¿Desactivar grupo de módulos?" })
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Desactivar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateModuleGroup).toHaveBeenCalledWith("mg1", {
        is_active: false,
      });
    });
  });

  it("opens create module modal and creates a module with group selection", async () => {
    const user = userEvent.setup();
    vi.mocked(services.createModule).mockResolvedValue({
      id: "m4",
      key: "billing",
      link: "/settings/billing",
      module_group_id: "mg1",
      is_active: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    const newModuleBtn = screen.getByRole("button", {
      name: /Nuevo Módulo/i,
    });
    await user.click(newModuleBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Módulo" })
    ).toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText(/users, roles, settings/i);
    await user.type(keyInput, "billing");

    // Select group from SingleSelect
    const groupSelect = screen.getByRole("button", { name: "Grupo" });
    await user.click(groupSelect);

    await waitFor(() => {
      expect(
        screen.getByText("Administración (administration)")
      ).toBeInTheDocument();
    });

    const adminOption = screen.getByText("Administración (administration)");
    await user.click(adminOption);

    const linkInput = screen.getByPlaceholderText(/\/settings\/users/i);
    await user.type(linkInput, "/settings/billing");

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createModule).toHaveBeenCalledWith({
        key: "billing",
        module_group_id: "mg1",
        link: "/settings/billing",
        icon: null,
        is_active: true,
        translates: [
          {
            key: "key",
            es: "billing",
            en: "billing",
          },
        ],
      });
    });
  }, 15000);

  it("opens ConfirmDialog and deactivates an active module", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m1",
      key: "users",
      link: "/settings/users",
      is_active: false,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    const usersRow = screen.getByText("users").closest("tr")!;
    const actionBtn = within(usersRow).getByRole("button", {
      name: "Acciones",
    });
    await user.click(actionBtn);

    const deactivateOption = screen.getByRole("menuitem", {
      name: /Desactivar/i,
    });
    await user.click(deactivateOption);

    expect(
      screen.getByRole("heading", { name: "¿Desactivar módulo?" })
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Desactivar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith("m1", {
        is_active: false,
      });
    });
  });

  it("copies module id to clipboard and displays sileo toast", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button", { name: "Copiar ID" });
    await user.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith("mg1");
    expect(sileo.info).toHaveBeenCalledWith({
      title: "Copiar ID",
      description: "Copiado al portapapeles",
    });
  });

  it("opens filter modal with Identificador and Grupo options in Translate (key) format", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    const filterBtn = screen.getByRole("button", { name: /Abrir filtros/i });
    await user.click(filterBtn);

    expect(screen.getByText("Filtros de módulos")).toBeInTheDocument();

    const groupFilterInput = screen.getByText(/Seleccionar grupo.../i);
    await user.click(groupFilterInput);

    await waitFor(() => {
      expect(
        screen.getByText("Administración (administration)")
      ).toBeInTheDocument();
      expect(screen.getByText("Reportes (reports)")).toBeInTheDocument();
    });
  });
});
