import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactElement } from "react";
import Business from "../../../../../modules/business/pages/Business/Business";
import * as businessServices from "../../../../../modules/business/infrastructure/services";
import type {
  BusinessEntity,
  GetBusinessesResponse,
} from "../../../../../modules/business/infrastructure/types";
import useAuthStore from "../../../../../store/authStore";
import { useGeneralSettingsStore } from "../../../../../store/generalSettings";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../../modules/business/infrastructure/services", () => ({
  getBusinesses: vi.fn(),
  createBusiness: vi.fn(),
  updateBusiness: vi.fn(),
  assignCollaborators: vi.fn(),
}));

const mockBusinesses: BusinessEntity[] = [
  {
    id: "biz-1",
    name: "La Buena Mesa",
    owner_id: "42",
    has_description: true,
    is_active: true,
    collaborators_count: 3,
    has_collaborators: true,
    products_count: 120,
    top_providers: [
      { id: "prov-1", name: "Nexus Distribución", products_count: 50 },
      { id: "prov-2", name: "Andina Logistics", products_count: 40 },
      { id: "prov-3", name: "Global Imports", products_count: 30 },
    ],
    has_more_providers: true,
    total_providers_count: 5,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    translates: [
      {
        key: "description",
        es: "Restaurante de comida tradicional con ingredientes frescos",
        en: "Traditional food restaurant with fresh ingredients",
      },
    ],
  },
  {
    id: "biz-2",
    name: "Tech Solutions",
    owner_id: "42",
    has_description: false,
    is_active: false,
    collaborators_count: 0,
    has_collaborators: false,
    products_count: 0,
    top_providers: [],
    has_more_providers: false,
    total_providers_count: 0,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    translates: [],
  },
];

const mockResponse: GetBusinessesResponse = {
  data: mockBusinesses,
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
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe("Business Page", () => {
  beforeEach(() => {
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test user" },
    });
    useGeneralSettingsStore.getState().clearContext();
    vi.clearAllMocks();
    vi.mocked(businessServices.getBusinesses).mockResolvedValue(mockResponse);
  });

  it("renders business listing with header, filter bar, and business cards", async () => {
    renderWithClient(<Business />);

    // Header
    expect(screen.getByText("Negocios")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Nuevo Negocio/i })
    ).toBeInTheDocument();

    // Cards content
    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
      expect(screen.getByText("Tech Solutions")).toBeInTheDocument();
    });

    // Products and collaborators count
    expect(screen.getByText("120 productos")).toBeInTheDocument();
    expect(screen.getByText("0 productos")).toBeInTheDocument();
    expect(screen.getByText("3 colaboradores")).toBeInTheDocument();
    expect(screen.getByText("Sin colaboradores")).toBeInTheDocument();

    // Provider chips & ellipsis
    expect(screen.getByText("Nexus Distribución")).toBeInTheDocument();
    expect(screen.getByText("Andina Logistics")).toBeInTheDocument();
    expect(screen.getByText("Global Imports")).toBeInTheDocument();
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("opens create business modal when clicking 'Nuevo Negocio'", async () => {
    const user = userEvent.setup();
    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    const newBtn = screen.getByRole("button", { name: /Nuevo Negocio/i });
    await user.click(newBtn);

    expect(
      screen.getByRole("heading", { name: "Nuevo Negocio" })
    ).toBeInTheDocument();
  });

  it("opens action menu and triggers status toggle confirm dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(businessServices.updateBusiness).mockResolvedValue({
      ...mockBusinesses[0],
      is_active: false,
    });

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole("button", {
      name: "Opciones de negocio",
    });
    await user.click(menuButtons[0]);

    const deactivateOption = screen.getByRole("menuitem", {
      name: "Desactivar",
    });
    await user.click(deactivateOption);

    expect(screen.getByText("¿Desactivar negocio?")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Desactivar" });
    await user.click(confirmBtn);

    expect(businessServices.updateBusiness).toHaveBeenCalledWith("biz-1", {
      is_active: false,
    });
  });

  it("opens edit modal when clicking 'Actualizar' in action menu", async () => {
    const user = userEvent.setup();
    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByRole("button", {
      name: "Opciones de negocio",
    });
    await user.click(menuButtons[0]);

    const editOption = screen.getByRole("menuitem", {
      name: "Actualizar",
    });
    await user.click(editOption);

    expect(
      screen.getByRole("heading", { name: "Actualizar Negocio" })
    ).toBeInTheDocument();
  });

  it("renders empty state when no businesses match", async () => {
    vi.mocked(businessServices.getBusinesses).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(
        screen.getByText("No hay negocios para mostrar")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Crear mi primer negocio" })
      ).toBeInTheDocument();
    });
  });

  it("only shows the 3 dots contextual menu for businesses where current user is the owner", async () => {
    vi.mocked(businessServices.getBusinesses).mockResolvedValue({
      data: [
        {
          id: "biz-owner",
          name: "My Owned Store",
          owner_id: "42",
          has_description: false,
          is_active: true,
          collaborators_count: 1,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          translates: [],
        },
        {
          id: "biz-collaborator",
          name: "Other Business As Collaborator",
          owner_id: "999",
          user_role: "collaborator",
          has_description: false,
          is_active: true,
          collaborators_count: 5,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          translates: [],
        },
      ],
      meta: { page: 1, limit: 10, total_items: 2, total_pages: 1 },
    });

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("My Owned Store")).toBeInTheDocument();
      expect(
        screen.getByText("Other Business As Collaborator")
      ).toBeInTheDocument();
    });

    // There should only be 1 contextual menu button (only for the owned store)
    const menuButtons = screen.getAllByRole("button", {
      name: "Opciones de negocio",
    });
    expect(menuButtons).toHaveLength(1);
  });

  it("renders pagination controls with selector options [10, 15, 20, 25]", async () => {
    const user = userEvent.setup();
    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    // Verify pagination labels
    expect(screen.getByText("Filas por página:")).toBeInTheDocument();
    expect(screen.getByText(/1–2 de 2/)).toBeInTheDocument();

    // Verify rowsPerPage combobox default is 10
    const rowsPerPageSelect = screen.getByRole("combobox");
    expect(rowsPerPageSelect).toHaveTextContent("10");

    // Open combobox and check options [10, 15, 20, 25]
    await user.click(rowsPerPageSelect);
    expect(screen.getByRole("option", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "15" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "20" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "25" })).toBeInTheDocument();
  });

  it("handles page change and limit change correctly", async () => {
    const user = userEvent.setup();
    vi.mocked(businessServices.getBusinesses).mockImplementation(async (params) => ({
      data: mockBusinesses,
      meta: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        total_items: 30,
        total_pages: Math.ceil(30 / (params?.limit ?? 10)),
      },
    }));

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    // Initial fetch: page: 1, limit: 10
    expect(businessServices.getBusinesses).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
      })
    );

    // Click next page button
    const nextPageBtn = screen.getByRole("button", { name: /siguiente|next/i });
    expect(nextPageBtn).toBeEnabled();
    await user.click(nextPageBtn);

    await waitFor(() => {
      expect(businessServices.getBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      );
    });

    // Change limit to 15 (resets page to 0, sending page: 1)
    const rowsPerPageSelect = screen.getByRole("combobox");
    await user.click(rowsPerPageSelect);
    const option15 = screen.getByRole("option", { name: "15" });
    await user.click(option15);

    await waitFor(() => {
      expect(businessServices.getBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 15,
        })
      );
    });
  });

  it("does not render super admin switch when user does not have super_admin role", async () => {
    useGeneralSettingsStore.getState().clearContext();
    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    expect(
      screen.queryByLabelText("Ver todos los negocios")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Ver todos los negocios")
    ).not.toBeInTheDocument();
  });

  it("renders super admin switch when user has super_admin role", async () => {
    useGeneralSettingsStore.getState().setContext({
      roles: ["super_admin"],
      actions: [],
      modules: [],
    });

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Ver todos los negocios")
    ).toBeInTheDocument();
    expect(screen.getByText("Ver todos los negocios")).toBeInTheDocument();
  });

  it("initializes switch as unchecked and sends all_businesses: false on initial fetch", async () => {
    useGeneralSettingsStore.getState().setContext({
      roles: ["super_admin"],
      actions: [],
      modules: [],
    });

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    const switchInput = screen.getByRole("switch", {
      name: /ver todos los negocios/i,
    });
    expect(switchInput).not.toBeChecked();

    expect(businessServices.getBusinesses).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 10,
        all_businesses: false,
      })
    );
  });

  it("triggers fetch with all_businesses: true when switch is turned on", async () => {
    const user = userEvent.setup();
    useGeneralSettingsStore.getState().setContext({
      roles: ["super_admin"],
      actions: [],
      modules: [],
    });

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    const switchInput = screen.getByRole("switch", {
      name: /ver todos los negocios/i,
    });
    expect(switchInput).not.toBeChecked();

    await user.click(switchInput);
    expect(switchInput).toBeChecked();

    await waitFor(() => {
      expect(businessServices.getBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          all_businesses: true,
        })
      );
    });
  });

  it("sends correct queryParams and resets page when searching with switch off vs on", async () => {
    const user = userEvent.setup();
    useGeneralSettingsStore.getState().setContext({
      roles: ["super_admin"],
      actions: [],
      modules: [],
    });

    vi.mocked(businessServices.getBusinesses).mockImplementation(async (params) => ({
      data: mockBusinesses,
      meta: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        total_items: 20,
        total_pages: 2,
      },
    }));

    renderWithClient(<Business />);

    await waitFor(() => {
      expect(screen.getByText("La Buena Mesa")).toBeInTheDocument();
    });

    // Move to page 2 first
    const nextPageBtn = screen.getByRole("button", { name: /siguiente|next/i });
    await user.click(nextPageBtn);

    await waitFor(() => {
      expect(businessServices.getBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });

    // Search with switch off: should reset page to 1 and query with all_businesses: false and name_cont
    const searchInput = screen.getByPlaceholderText(/buscar por nombre de negocio/i);
    await user.type(searchInput, "Mesa");

    await waitFor(() => {
      expect(businessServices.getBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          all_businesses: false,
          q: expect.objectContaining({
            name_cont: "Mesa",
          }),
        })
      );
    });

    // Wait until switch is enabled after fetch completes
    const switchInput = await screen.findByRole("switch", {
      name: /ver todos los negocios/i,
    });
    await waitFor(() => {
      expect(switchInput).toBeEnabled();
    });

    // Turn switch on: should reset page to 1 and query with all_businesses: true and name_cont
    await user.click(switchInput);

    await waitFor(() => {
      expect(businessServices.getBusinesses).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          all_businesses: true,
          q: expect.objectContaining({
            name_cont: "Mesa",
          }),
        })
      );
    });
  });
});

