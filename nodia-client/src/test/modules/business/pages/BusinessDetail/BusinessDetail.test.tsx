import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import BusinessDetail from "../../../../../modules/business/pages/BusinessDetail/BusinessDetail";
import * as businessServices from "../../../../../modules/business/infrastructure/services";
import type { BusinessEntity } from "../../../../../modules/business/infrastructure/types";
import useAuthStore from "../../../../../store/authStore";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../../hooks/useAuth", () => ({
  default: () => ({
    token: "test-jwt",
    user: { id: "42", name: "Oscar Valenzuela" },
    isAuthenticated: true,
    isSessionActive: true,
    isSessionValid: true,
    isDemo: false,
    sessionStatus: "authenticated",
  }),
}));

vi.mock("../../../../../modules/business/infrastructure/services", () => ({
  getBusinessById: vi.fn(),
  updateBusiness: vi.fn(),
  assignCollaborators: vi.fn(),
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  bulkCreateProducts: vi.fn(),
  bulkUpdateProducts: vi.fn(),
  getProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  getInvoices: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
}));

const mockBusiness: BusinessEntity = {
  id: "biz-123",
  name: "Panadería Central",
  owner_id: "42",
  has_description: true,
  is_active: true,
  collaborators_count: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  owner: {
    id: "42",
    name: "Oscar Valenzuela",
    email: "oscar@example.com",
  },
  collaborators: [
    {
      id: "collab-1",
      user_id: "user-99",
      position: "Jefe de Compras",
      action_ids: ["act-1"],
      is_active: true,
      user: {
        id: "user-99",
        name: "Carlos Sanchez",
        email: "carlos@example.com",
      },
    },
  ],
  translates: [
    {
      key: "description",
      es: "Panadería artesanal con productos horneados a diario",
      en: "Artisanal bakery with daily baked goods",
    },
  ],
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
    <MemoryRouter initialEntries={["/business/biz-123"]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/business/:id" element={ui} />
          <Route path="/business" element={<div>Business List Page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("BusinessDetail Page", () => {
  beforeEach(() => {
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test user" },
    });
    vi.clearAllMocks();
    vi.mocked(businessServices.getBusinessById).mockResolvedValue(mockBusiness);
    vi.mocked(businessServices.getProducts).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 1 },
    });
    vi.mocked(businessServices.getProviders).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 1 },
    });
    vi.mocked(businessServices.getInvoices).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 1 },
    });
  });

  it("renders business details with header, breadcrumb, owner, and default overview tab", async () => {
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    // Breadcrumb root present
    expect(screen.getByTestId("breadcrumb-root")).toBeInTheDocument();

    // Owner and badge
    expect(screen.getByText(/Oscar Valenzuela/i)).toBeInTheDocument();

    // Description
    expect(
      screen.getByText("Panadería artesanal con productos horneados a diario")
    ).toBeInTheDocument();

    // Action buttons in header
    expect(
      screen.getByRole("button", { name: "Actualizar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Agregar colaborador/i })
    ).toBeInTheDocument();

    // Default tab: Resumen general KPIs
    expect(screen.getByText(/Catálogo de Productos/i)).toBeInTheDocument();
    expect(screen.getByText(/Proveedores Registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/Rendimiento Comercial/i)).toBeInTheDocument();
  });

  it("navigates back to business list when clicking breadcrumb link", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    const backLink = screen.getByRole("link", { name: "Negocios" });
    await user.click(backLink);

    expect(screen.getByText("Business List Page")).toBeInTheDocument();
  });

  it("opens edit modal when clicking 'Actualizar'", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    const editBtn = screen.getByRole("button", { name: "Actualizar" });
    await user.click(editBtn);

    expect(
      screen.getByRole("heading", { name: "Actualizar Negocio" })
    ).toBeInTheDocument();
  });

  it("opens collaborator modal when clicking 'Agregar colaborador'", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    const addCollabBtn = screen.getByRole("button", {
      name: /Agregar colaborador/i,
    });
    await user.click(addCollabBtn);

    expect(
      screen.getByText("Gestionar Colaboradores del Negocio")
    ).toBeInTheDocument();
  });

  it("switches tabs to Proveedores, Productos, Facturas, and Colaboradores", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    // 1. Switch to Proveedores tab
    const providersTab = screen.getByRole("tab", { name: /Proveedores/i });
    await user.click(providersTab);

    expect(
      await screen.findByRole("button", { name: /Administrar proveedores/i })
    ).toBeInTheDocument();

    // 2. Switch to Productos tab
    const productsTab = screen.getByRole("tab", { name: /Productos/i });
    await user.click(productsTab);

    expect(
      await screen.findByRole("button", { name: /Administrar productos/i })
    ).toBeInTheDocument();

    // 3. Switch to Facturas tab
    const invoicesTab = screen.getByRole("tab", { name: /Facturas/i });
    await user.click(invoicesTab);

    expect(
      await screen.findByRole("button", { name: /Registrar Factura/i })
    ).toBeInTheDocument();

    // 4. Switch to Colaboradores tab
    const collaboratorsTab = screen.getByRole("tab", { name: /Colaboradores/i });
    await user.click(collaboratorsTab);

    expect(await screen.findByText("Carlos Sanchez")).toBeInTheDocument();
    expect(screen.getByText("Jefe de Compras")).toBeInTheDocument();
  });
});
