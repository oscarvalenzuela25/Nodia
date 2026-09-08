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
    key: "users",
    group_by: "administration",
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
    group_by: "administration",
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
    group_by: "reports",
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

  it("renders modules table with expected columns and initial modules", async () => {
    renderWithClient(<Modules />);

    expect(screen.getAllByText("Módulos").length).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText("Id")).toBeInTheDocument();
      expect(screen.getByText("Nombre")).toBeInTheDocument();
      expect(screen.getByText("Identificador")).toBeInTheDocument();
      expect(screen.getByText("Grupo")).toBeInTheDocument();
      expect(screen.getByText("Activo")).toBeInTheDocument();
      expect(screen.getByText("Acciones")).toBeInTheDocument();

      expect(screen.getByText("users")).toBeInTheDocument();
      expect(screen.getByText("Usuarios")).toBeInTheDocument();
      expect(screen.getAllByText("administration").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("untranslated_feature")).toBeInTheDocument();
    });
  });

  it("fetches modules for filters with all=true & includes=false and for table with includes=true", async () => {
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
    });
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

  it("opens create module modal and creates a module via createModule", async () => {
    const user = userEvent.setup();
    vi.mocked(services.createModule).mockResolvedValue({
      id: "m4",
      key: "billing",
      group_by: "finance",
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

    const groupInput = screen.getByPlaceholderText(/settings, catalog/i);
    await user.type(groupInput, "finance");

    const submitBtn = screen.getByRole("button", { name: "Crear Módulo" });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.createModule).toHaveBeenCalledWith({
        key: "billing",
        group_by: "finance",
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
  });

  it("opens action menu with 'Actualizar' and updates module via updateModule", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m1",
      key: "users",
      group_by: "administration_updated",
      is_active: true,
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

    const updateOption = screen.getByRole("menuitem", { name: /Actualizar/i });
    expect(updateOption).toBeInTheDocument();

    await user.click(updateOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Módulo" })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("users")).toBeInTheDocument();
    expect(screen.getByDisplayValue("administration")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", {
      name: "Actualizar Módulo",
    });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({
          key: "users",
          group_by: "administration",
          is_active: true,
          translates: [
            {
              key: "key",
              es: "Usuarios",
              en: "Users",
            },
          ],
        })
      );
    });
  });

  it("opens ConfirmDialog and deactivates an active module", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m1",
      key: "users",
      group_by: "administration",
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
    expect(
      screen.getByText('¿Está seguro de que desea desactivar el módulo "users"?')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Desactivar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith("m1", {
        is_active: false,
      });
    });
  });

  it("opens ConfirmDialog and activates an inactive module", async () => {
    const user = userEvent.setup();
    vi.mocked(services.updateModule).mockResolvedValue({
      id: "m3",
      key: "untranslated_feature",
      group_by: "reports",
      is_active: true,
    });

    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("untranslated_feature")).toBeInTheDocument();
    });

    const row = screen.getByText("untranslated_feature").closest("tr")!;
    const actionBtn = within(row).getByRole("button", {
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
        '¿Está seguro de que desea activar el módulo "untranslated_feature"?'
      )
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Activar" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(services.updateModule).toHaveBeenCalledWith("m3", {
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
      expect(screen.getByText("users")).toBeInTheDocument();
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
    vi.mocked(services.getModules).mockImplementation(async (params) => {
      if (params?.page) {
        throw new Error("Network connection error");
      }
      return mockPaginatedResponse;
    });

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

  it("opens filter modal with Identificador and Grupo filter fields", async () => {
    const user = userEvent.setup();
    renderWithClient(<Modules />);

    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });

    // Open filter modal
    const filterBtn = screen.getByRole("button", { name: /Abrir filtros/i });
    await user.click(filterBtn);

    expect(screen.getByText("Filtros de módulos")).toBeInTheDocument();
    expect(screen.getAllByText("Identificador").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Grupo").length).toBeGreaterThanOrEqual(2);

    // Click Identificador filter input to open options
    const keyInput = screen.getByText(/ej: users, roles, settings/i);
    await user.click(keyInput);

    await waitFor(() => {
      expect(screen.getByText("Usuarios (users)")).toBeInTheDocument();
      expect(screen.getByText("Roles (roles)")).toBeInTheDocument();
    });
  });
});


