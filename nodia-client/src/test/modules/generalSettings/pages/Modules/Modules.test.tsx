import useAuthStore from "../../../../../store/authStore";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    deleteModule: vi.fn(),
    deleteModuleGroup: vi.fn(),
  }),
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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("Modules Page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    useAuthStore
      .getState()
      .login({
        token: "test-jwt",
        expiresAt: Date.now() + 900_000,
        user: { id: "42", name: "Test user" },
      });
    vi.clearAllMocks();
    vi.mocked(services.deleteModule).mockReset().mockResolvedValue(undefined);
    vi.mocked(services.deleteModuleGroup)
      .mockReset()
      .mockResolvedValue(undefined);
    vi.mocked(services.getModules).mockResolvedValue(mockModulesPaginated);
    vi.mocked(services.getModuleGroups).mockResolvedValue(mockGroupsPaginated);
  });

  it("renders dual view with both tables, perspective switcher, and expected columns", async () => {
    renderWithClient(<Modules />);

    expect(screen.getAllByText("Módulos").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();

    // Perspective switcher options
    expect(
      screen.getByRole("button", { name: /Vista Conjunta/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Solo Módulos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Solo Grupos/i }),
    ).toBeInTheDocument();

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
      expect(
        screen.getAllByText("Administración").length,
      ).toBeGreaterThanOrEqual(2);
      expect(
        screen.getAllByText("administration").length,
      ).toBeGreaterThanOrEqual(2);
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
    const modulesOnlyBtn = screen.getByRole("button", {
      name: /Solo Módulos/i,
    });
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
        q: { is_active_eq: true },
      });
      expect(services.getModuleGroups).toHaveBeenCalledWith({
        all: true,
      });
      expect(services.getModuleGroups).toHaveBeenCalledWith({
        page: 1,
        limit: 5,
        q: { is_active_eq: true },
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
      "Buscar por identificador...",
    );

    await user.type(searchInput, "roles");

    await waitFor(() => {
      expect(services.getModules).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.objectContaining({
            key_cont: "roles",
          }),
        }),
      );
    });
  });

  it("filters groups using InputSearch in the groups deck", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("Grupos de Módulos")).toBeInTheDocument();
      expect(
        screen.getAllByText("administration").length,
      ).toBeGreaterThanOrEqual(1);
    });

    const searchGroupInput = screen.getByPlaceholderText(
      /Buscar por nombre o identificador de grupo/i,
    );

    await user.type(searchGroupInput, "admin");

    await waitFor(() => {
      expect(services.getModuleGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.objectContaining({
            key_cont: "admin",
          }),
        }),
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
      screen.getByRole("heading", { name: "Nuevo Grupo de Módulos" }),
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
        screen.getAllByText("administration").length,
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
      screen.getByRole("heading", { name: "¿Desactivar grupo de módulos?" }),
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
      screen.getByRole("heading", { name: "Nuevo Módulo" }),
    ).toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText(/users, roles, settings/i);
    await user.type(keyInput, "billing");

    // Select group from SingleSelect
    const groupSelect = screen.getByRole("button", { name: "Grupo" });
    await user.click(groupSelect);

    await waitFor(() => {
      expect(
        screen.getByText("Administración (administration)"),
      ).toBeInTheDocument();
    });

    const adminOption = screen.getByText("Administración (administration)");
    await user.click(adminOption);

    const linkSelect = screen.getByRole("button", { name: "Ruta" });
    await user.click(linkSelect);

    await waitFor(() => {
      expect(
        screen.getByText(/Proveedores de IA \(\/settings\/ai-providers\)/i),
      ).toBeInTheDocument();
    });

    const routeOption = screen.getByText(
      /Proveedores de IA \(\/settings\/ai-providers\)/i,
    );
    await user.click(routeOption);

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createModule).toHaveBeenCalledWith({
        key: "billing",
        module_group_id: "mg1",
        link: "/settings/ai-providers",
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
      screen.getByRole("heading", { name: "¿Desactivar módulo?" }),
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
        screen.getByText("Administración (administration)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Reportes (reports)")).toBeInTheDocument();
    });
  });

  it("filters groups by active, inactive and all, preserving search and resetting the page", async () => {
    const user = userEvent.setup();
    vi.mocked(services.getModuleGroups).mockResolvedValue({
      ...mockGroupsPaginated,
      meta: { page: 1, limit: 5, total_items: 11, total_pages: 3 },
    });
    renderWithClient(<Modules />);
    await screen.findAllByText("administration");
    expect(screen.getByRole("button", { name: "Activos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(
      screen.getAllByRole("button", { name: "Página siguiente" })[0],
    );
    await waitFor(() =>
      expect(services.getModuleGroups).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Inactivos" }));
    await waitFor(() =>
      expect(services.getModuleGroups).toHaveBeenCalledWith({
        page: 1,
        limit: 5,
        q: { is_active_eq: false },
      }),
    );
    await user.type(
      screen.getByPlaceholderText(/Buscar por nombre o identificador de grupo/),
      "report",
    );
    await waitFor(() =>
      expect(services.getModuleGroups).toHaveBeenCalledWith(
        expect.objectContaining({
          q: { is_active_eq: false, key_cont: "report" },
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Todos" }));
    await waitFor(() =>
      expect(services.getModuleGroups).toHaveBeenCalledWith({
        page: 1,
        limit: 5,
        q: { key_cont: "report" },
      }),
    );
    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  async function requestDeletion(kind: "module" | "group") {
    const user = userEvent.setup();
    const row =
      kind === "module"
        ? (await screen.findByText("users")).closest("tr")!
        : (await screen.findAllByText("administration"))[0].closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Acciones" }));
    await user.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    expect(services.deleteModule).not.toHaveBeenCalled();
    expect(services.deleteModuleGroup).not.toHaveBeenCalled();
    return { user, dialog: screen.getByRole("dialog") };
  }
  it.each(["module", "group"] as const)(
    "does not delete a %s when confirmation is cancelled",
    async (kind) => {
      renderWithClient(<Modules />);
      const { user, dialog } = await requestDeletion(kind);
      expect(within(dialog).getByText(/¿Está seguro/)).toBeInTheDocument();
      await user.click(
        within(dialog).getByRole("button", { name: "Cancelar" }),
      );
      expect(services.deleteModule).not.toHaveBeenCalled();
      expect(services.deleteModuleGroup).not.toHaveBeenCalled();
    },
  );
  it.each(["module", "group"] as const)(
    "deletes a confirmed %s and refreshes its lists",
    async (kind) => {
      const service =
        kind === "module" ? services.deleteModule : services.deleteModuleGroup;
      vi.mocked(service).mockResolvedValue(undefined);
      renderWithClient(<Modules />);
      const { user, dialog } = await requestDeletion(kind);
      vi.mocked(services.getModules).mockClear();
      vi.mocked(services.getModuleGroups).mockClear();
      await user.click(
        within(dialog).getByRole("button", { name: "Eliminar" }),
      );
      await waitFor(() =>
        expect(service).toHaveBeenCalledWith(kind === "module" ? "m1" : "mg1"),
      );
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", {
            name:
              kind === "module"
                ? "¿Eliminar módulo?"
                : "¿Eliminar grupo de módulos?",
          }),
        ).not.toBeInTheDocument(),
      );
      expect(services.getModules).toHaveBeenCalled();
      if (kind === "group") expect(services.getModuleGroups).toHaveBeenCalled();
      expect(sileo.success).toHaveBeenCalledWith(
        expect.objectContaining({
          description:
            kind === "module"
              ? "Módulo eliminado correctamente"
              : "Grupo de módulos eliminado correctamente",
        }),
      );
    },
  );
  it("retains the module confirmation and target on failure, blocks duplicate submissions and permits retry", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(services.deleteModule)
      .mockImplementationOnce(
        () =>
          new Promise((_, rejectPromise) => {
            reject = rejectPromise;
          }),
      )
      .mockResolvedValueOnce(undefined);
    renderWithClient(<Modules />);
    const { user, dialog } = await requestDeletion("module");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(
      within(dialog).getByRole("button", { name: "Eliminar" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toBeDisabled();
    await act(async () =>
      reject(
        Object.assign(new Error("Unavailable"), {
          response: { data: { message: "Synthetic outage" } },
        }),
      ),
    );
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Eliminar" }),
      ).toBeEnabled(),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Synthetic outage",
    );
    expect(within(dialog).getByText(/Usuarios/)).toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Synthetic outage" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "¿Eliminar módulo?" }),
      ).not.toBeInTheDocument(),
    );
    expect(services.deleteModule).toHaveBeenNthCalledWith(2, "m1");
  });
  it("explains a group association conflict and retains its confirmation", async () => {
    vi.mocked(services.deleteModuleGroup).mockRejectedValueOnce(
      Object.assign(new Error("Conflict"), {
        response: { data: { message: "modules:groups.delete_has_modules" } },
      }),
    );
    renderWithClient(<Modules />);
    const { user, dialog } = await requestDeletion("group");
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "incluidos los inactivos",
      ),
    );
    expect(
      screen.getByRole("heading", { name: "¿Eliminar grupo de módulos?" }),
    ).toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "No se puede eliminar el grupo porque tiene módulos asociados, incluidos los inactivos.",
      }),
    );
  });
  it("renders mobile cards with the same filters and deletion handlers", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
      matches: media.includes("max-width:599.95px"),
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    vi.mocked(services.deleteModule).mockResolvedValue(undefined);
    renderWithClient(<Modules />);
    const card = await screen.findByRole("article", { name: "Usuarios" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(within(card).getByText("/settings/users")).toBeInTheDocument();
    expect(
      within(card).getByText("Activo", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: "Administración" }),
    ).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /Acciones/ }));
    const option = screen.getByRole("menuitem", { name: "Eliminar" });
    expect(
      within(option).getByTestId("DeleteOutlinedIcon"),
    ).toBeInTheDocument();
    await user.click(option);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Eliminar",
      }),
    );
    await waitFor(() =>
      expect(services.deleteModule).toHaveBeenCalledWith("m1"),
    );
  });
  it.each(["module", "group"] as const)(
    "returns to the previous page after deleting its last %s",
    async (kind) => {
      let removed = false;
      if (kind === "module") {
        vi.mocked(services.getModules).mockImplementation(async (params) => ({
          data:
            params?.page === 2
              ? removed
                ? []
                : [mockModules[0]]
              : mockModules,
          meta: {
            page: params?.page ?? 1,
            limit: 10,
            total_items: removed ? 10 : 11,
            total_pages: removed ? 1 : 2,
          },
        }));
        vi.mocked(services.deleteModule).mockImplementation(async () => {
          removed = true;
        });
      } else {
        vi.mocked(services.getModuleGroups).mockImplementation(
          async (params) => ({
            data:
              params?.page === 2
                ? removed
                  ? []
                  : [mockGroups[0]]
                : mockGroups,
            meta: {
              page: params?.page ?? 1,
              limit: 5,
              total_items: removed ? 5 : 6,
              total_pages: removed ? 1 : 2,
            },
          }),
        );
        vi.mocked(services.deleteModuleGroup).mockImplementation(async () => {
          removed = true;
        });
      }
      const user = userEvent.setup();
      renderWithClient(<Modules />);
      await screen.findByText("users");
      await user.click(
        screen.getAllByRole("button", { name: "Página siguiente" })[
          kind === "module" ? 1 : 0
        ],
      );
      const fetch =
        kind === "module" ? services.getModules : services.getModuleGroups;
      await waitFor(() =>
        expect(fetch).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 2 }),
        ),
      );
      const { dialog } = await requestDeletion(kind);
      await user.click(
        within(dialog).getByRole("button", { name: "Eliminar" }),
      );
      await waitFor(() =>
        expect(fetch).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1 }),
        ),
      );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
    },
  );
});
