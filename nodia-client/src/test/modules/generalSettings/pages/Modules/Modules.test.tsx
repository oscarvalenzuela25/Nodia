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
  })
);

const mockModules: ModuleEntity[] = [
  {
    id: "m1",
    key: "general_settings",
    type: "module",
    parent_id: null,
    parent_module: null,
    is_active: true,
  },
  {
    id: "m2",
    key: "users",
    type: "submodule",
    parent_id: "m1",
    parent_module: {
      id: "m1",
      key: "general_settings",
      type: "module",
      is_active: true,
    },
    is_active: true,
  },
  {
    id: "m3",
    key: "untranslated_feature",
    type: "module",
    parent_id: null,
    parent_module: null,
    is_active: true,
  },
  {
    id: "m4",
    key: "export_logs",
    type: "submodule",
    parent_id: "m1",
    parent_module: {
      id: "m1",
      key: "general_settings",
      type: "module",
      is_active: true,
    },
    is_active: false,
  },
];

const mockPaginatedResponse: PaginatedResponse<ModuleEntity> = {
  data: mockModules,
  meta: {
    page: 1,
    limit: 10,
    total_items: mockModules.length,
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
    vi.clearAllMocks();
    vi.mocked(services.getModules).mockResolvedValue(mockPaginatedResponse);
  });

  it("renders modules table with expected columns and root modules initially collapsed", async () => {
    renderWithClient(<Modules />);

    expect(screen.getAllByText("Módulos").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText("Id")).toBeInTheDocument();
      expect(screen.getByText("Identificador")).toBeInTheDocument();
      expect(screen.getByText("Nombre del módulo")).toBeInTheDocument();
      expect(screen.getByText("Tipo")).toBeInTheDocument();
      expect(screen.getByText("Módulo padre")).toBeInTheDocument();
      expect(screen.getByText("Activo")).toBeInTheDocument();
      expect(screen.getByText("general_settings")).toBeInTheDocument();
      expect(
        screen.getAllByText("Ajustes Generales").length
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("untranslated_feature")).toBeInTheDocument();
      expect(
        screen.getAllByText("Sin módulo padre").length
      ).toBeGreaterThanOrEqual(1);
    });

    // Submodules users and export_logs should not be visible when collapsed
    expect(screen.queryByText("users")).not.toBeInTheDocument();
    expect(screen.queryByText("export_logs")).not.toBeInTheDocument();
  });

  it("expands and collapses submodules when clicking the arrow icon", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    // Parent module general_settings has submodules, so it has the expand arrow
    const expandBtn = screen.getByRole("button", {
      name: "Expandir submódulos",
    });
    expect(expandBtn).toBeInTheDocument();

    // Click expand
    await user.click(expandBtn);

    // Now submodules are visible
    expect(screen.getByText("users")).toBeInTheDocument();
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("export_logs")).toBeInTheDocument();

    // Button label changed to collapse
    const collapseBtn = screen.getByRole("button", {
      name: "Colapsar submódulos",
    });
    expect(collapseBtn).toBeInTheDocument();

    // Click collapse
    await user.click(collapseBtn);

    // Submodules are hidden again
    expect(screen.queryByText("users")).not.toBeInTheDocument();
    expect(screen.queryByText("export_logs")).not.toBeInTheDocument();
  });

  it("does not display expand arrow for modules without submodules", async () => {
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("untranslated_feature")).toBeInTheDocument();
    });

    const untranslatedRow = screen
      .getByText("untranslated_feature")
      .closest("tr")!;
    expect(
      within(untranslatedRow).queryByRole("button", {
        name: /submódulos/i,
      })
    ).not.toBeInTheDocument();
  });

  it("displays '-' when a module does not have a translated name", async () => {
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("untranslated_feature")).toBeInTheDocument();
    });

    const row = screen.getByText("untranslated_feature").closest("tr")!;
    expect(within(row).getByText("-")).toBeInTheDocument();
  });

  it("filters modules using InputSearch with key_cont", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Buscar por identificador..."
    );

    await user.type(searchInput, "users");

    await waitFor(() => {
      expect(services.getModules).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.objectContaining({
            key_cont: "users",
          }),
        })
      );
    });
  });

  it("renders child module as a root row without expand arrow when only child is in result", async () => {
    vi.mocked(services.getModules).mockResolvedValue({
      data: [
        {
          id: "m2",
          key: "users",
          type: "submodule",
          parent_id: "m1",
          parent_module: {
            id: "m1",
            key: "general_settings",
            type: "module",
            is_active: true,
          },
          is_active: true,
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
      expect(screen.getByText("Usuarios")).toBeInTheDocument();
    });

    const usersRow = screen.getByText("users").closest("tr")!;
    expect(
      within(usersRow).queryByRole("button", {
        name: /submódulos/i,
      })
    ).not.toBeInTheDocument();
  });

  it("opens create module modal and creates a module via createModule", async () => {
    const user = userEvent.setup();
    vi.mocked(services.createModule).mockResolvedValue({
      id: "m5",
      key: "billing",
      type: "module",
      parent_id: null,
      parent_module: null,
      is_active: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    const newModuleBtn = screen.getByRole("button", {
      name: /Nuevo Módulo/i,
    });
    await user.click(newModuleBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Módulo" })
    ).toBeInTheDocument();

    const keyInput = screen.getByLabelText(/Identificador \/ Key/i);
    await user.type(keyInput, "billing");

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createModule).toHaveBeenCalledWith({
        key: "billing",
        type: "module",
        parent_id: null,
        is_active: true,
      });
    });
  });

  it("opens action menu with 'Actualizar' and updates module via updateModule", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m1",
      key: "general_settings_updated",
      type: "module",
      parent_id: null,
      parent_module: null,
      is_active: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    const generalSettingsRow = screen
      .getByText("general_settings")
      .closest("tr")!;
    const actionBtn = within(generalSettingsRow).getByRole("button", {
      name: "Acciones",
    });
    await user.click(actionBtn);

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Módulo" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("general_settings")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: "Actualizar Módulo",
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({
          key: "general_settings",
          type: "module",
        })
      );
    });
  });

  it("shows conditional warning when deactivating a module with children and calls updateModule", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m1",
      key: "general_settings",
      type: "module",
      parent_id: null,
      parent_module: null,
      is_active: false,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    const generalSettingsRow = screen
      .getByText("general_settings")
      .closest("tr")!;
    const actionBtn = within(generalSettingsRow).getByRole("button", {
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
    expect(
      screen.getByText(
        /Todos los submódulos asociados también quedarán deshabilitados/i
      )
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Desactivar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith("m1", {
        is_active: false,
      });
    });
  });

  it("shows standard deactivation message when deactivating an expanded submodule", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    // Expand general_settings to reveal users
    const expandBtn = screen.getByRole("button", {
      name: "Expandir submódulos",
    });
    await user.click(expandBtn);

    expect(screen.getByText("users")).toBeInTheDocument();

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
    expect(
      screen.getByText(
        '¿Está seguro de que desea desactivar el módulo "users"?'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        /Todos los submódulos asociados también quedarán deshabilitados/i
      )
    ).not.toBeInTheDocument();
  });

  it("shows activation dialog and activates an inactive module", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m4",
      key: "export_logs",
      type: "submodule",
      parent_id: "m1",
      parent_module: {
        id: "m1",
        key: "general_settings",
        type: "module",
        is_active: true,
      },
      is_active: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    // Expand general_settings to reveal inactive export_logs
    const expandBtn = screen.getByRole("button", {
      name: "Expandir submódulos",
    });
    await user.click(expandBtn);

    expect(screen.getByText("export_logs")).toBeInTheDocument();

    const exportLogsRow = screen.getByText("export_logs").closest("tr")!;
    const actionBtn = within(exportLogsRow).getByRole("button", {
      name: "Acciones",
    });
    await user.click(actionBtn);

    const activateOption = screen.getByRole("menuitem", { name: /Activar/i });
    await user.click(activateOption);

    expect(
      screen.getByRole("heading", { name: "¿Activar módulo?" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '¿Está seguro de que desea activar el módulo "export_logs"?'
      )
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Activar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith("m4", {
        is_active: true,
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
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    const copyButtons = screen.getAllByRole("button", { name: "Copiar ID" });
    await user.click(copyButtons[0]);

    expect(writeTextMock).toHaveBeenCalledWith("m1");
    expect(sileo.info).toHaveBeenCalledWith({
      title: "Copiar ID",
      description: "Copiado al portapapeles",
    });
  });

  it("renders empty state when no modules are returned", async () => {
    vi.mocked(services.getModules).mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        limit: 10,
        total_items: 0,
        total_pages: 0,
      },
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(
        screen.getByText("No hay módulos disponibles")
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Crear primer módulo" })
    ).toBeInTheDocument();
  });

  it("renders error state when query fails and allows retry", async () => {
    vi.mocked(services.getModules).mockRejectedValue(
      new Error("Network connection error")
    );

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(
        screen.getByText("Error al cargar los módulos")
      ).toBeInTheDocument();
      expect(screen.getByText("Network connection error")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Reintentar" });
    expect(retryBtn).toBeInTheDocument();
  });

  it("displays conditional module and submodule inputs in filter modal when types are selected", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("general_settings")).toBeInTheDocument();
    });

    // Open filter modal
    const filterBtn = screen.getByRole("button", { name: /Abrir filtros/i });
    await user.click(filterBtn);

    expect(screen.getByText("Filtros de módulos")).toBeInTheDocument();

    // Initially, neither "Módulos" nor "Submódulos" select inputs are present
    expect(
      screen.queryByText("Seleccionar módulos...")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Seleccionar submódulos...")
    ).not.toBeInTheDocument();

    // Click Tipo select trigger to open options popover
    const typeSelect = screen.getByRole("button", { name: "Tipo" });
    await user.click(typeSelect);

    // Select "Módulo"
    const moduleOption = screen.getByRole("menuitem", { name: "Módulo" });
    await user.click(moduleOption);

    // Now the conditional "Módulos" input appears
    expect(screen.getByText("Seleccionar módulos...")).toBeInTheDocument();

    // Select "Submódulo" as well
    const submoduleOption = screen.getByRole("menuitem", { name: "Submódulo" });
    await user.click(submoduleOption);

    // Now both "Módulos" and "Submódulos" are present
    expect(screen.getByText("Seleccionar submódulos...")).toBeInTheDocument();
  });
});

