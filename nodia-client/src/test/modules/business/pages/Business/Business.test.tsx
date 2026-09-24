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
});

