import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { OverviewTab } from "../../../../../../../modules/business/pages/BusinessDetail/components/OverviewTab/OverviewTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import useAuthStore from "../../../../../../../store/authStore";
import type {
  ProductEntity,
  ProviderEntity,
  InvoiceEntity,
} from "../../../../../../../modules/business/infrastructure/types";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../../../../hooks/useAuth", () => ({
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

vi.mock("../../../../../../../modules/business/infrastructure/services", () => ({
  getProducts: vi.fn(),
  getProductAvailability: vi.fn(),
  getProviders: vi.fn(),
  getInvoices: vi.fn(),
}));

const mockProviders: ProviderEntity[] = [
  {
    id: "prov-1",
    business_id: "biz-123",
    name: "Distribuidora Central",
    tax: 19,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prov-2",
    business_id: "biz-123",
    name: "Insumos Norte",
    tax: 19,
    is_active: false,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const mockProducts: ProductEntity[] = [
  {
    id: "prod-1",
    business_id: "biz-123",
    provider_id: "prov-1",
    code: "PROD-001",
    name: "Café de Especialidad 250g",
    cost_price: 5000,
    cost_price_tax: 5950,
    sale_price: 1000,
    stock: 15, // Normal stock (>= 10)
    is_active: true,
  },
  {
    id: "prod-2",
    business_id: "biz-123",
    provider_id: "prov-1",
    code: "PROD-002",
    name: "Té Verde Matcha",
    cost_price: 3000,
    cost_price_tax: 3570,
    sale_price: 2000,
    stock: 5, // Low stock (0 < stock < 10)
    is_active: true,
  },
  {
    id: "prod-3",
    business_id: "biz-123",
    provider_id: "prov-2",
    code: "PROD-003",
    name: "Endulzante Natural",
    cost_price: 1000,
    cost_price_tax: 1190,
    sale_price: 500,
    stock: 0, // Sin stock (<= 0)
    is_active: true,
  },
];

// Current month date string (e.g. 2026-09-15)
const now = new Date();
const currentYear = now.getFullYear();
const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
const currentMonthDate = `${currentYear}-${currentMonthStr}-15`;
// The KPI uses the host number locale; the amount must stay exact on every runner.
const currentMonthTotal = `$${new Intl.NumberFormat().format(50_000)}`;
const pastMonthTotal = `$${new Intl.NumberFormat().format(100_000)}`;

const mockInvoices: InvoiceEntity[] = [
  {
    id: "inv-1",
    business_id: "biz-123",
    provider_id: "prov-1",
    code: "FAC-CURRENT",
    total_amount: 50000,
    path_storage: "https://example.com/inv1.pdf",
    is_active: true,
    created_at: `${currentMonthDate}T10:00:00Z`,
    data: {
      issue_date: currentMonthDate,
      status: "paid",
    },
  },
  {
    id: "inv-2",
    business_id: "biz-123",
    provider_id: "prov-2",
    code: "FAC-PAST",
    total_amount: 100000,
    path_storage: "https://example.com/inv2.pdf",
    is_active: true,
    created_at: "2024-01-01T10:00:00Z",
    data: {
      issue_date: "2024-01-01",
      status: "paid",
    },
  },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderOverviewTab = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe("OverviewTab Component", () => {
  beforeEach(() => {
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Oscar Valenzuela" },
    });
    vi.clearAllMocks();
    vi.mocked(businessServices.getProductAvailability).mockResolvedValue({ total: 3, available: 1, unavailable: 1, unknown: 1, activity: "active" });
    vi.mocked(businessServices.getProducts).mockResolvedValue({
      data: mockProducts,
      meta: { total_items: 3, page: 1, limit: 50, total_pages: 1 },
    });
    vi.mocked(businessServices.getProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 2, page: 1, limit: 50, total_pages: 1 },
    });
    vi.mocked(businessServices.getInvoices).mockResolvedValue({
      data: mockInvoices,
      meta: { total_items: 2, page: 1, limit: 50, total_pages: 1 },
    });
  });

  it("renders catalog, commercial performance and providers in reading order without removed labels", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Catálogo de Productos")).toBeInTheDocument();
    });

    // OPERACIÓN DE ALMACÉN and CADENA DE ABASTECIMIENTO are eliminated
    expect(screen.queryByText("OPERACIÓN DE ALMACÉN")).not.toBeInTheDocument();
    expect(screen.queryByText("CADENA DE ABASTECIMIENTO")).not.toBeInTheDocument();

    const productsHeader = screen.getByText("Catálogo de Productos");
    const providersHeader = screen.getByText("Proveedores Registrados");
    const performanceHeader = screen.getByText("RENDIMIENTO COMERCIAL");

    expect(productsHeader).toBeInTheDocument();
    expect(providersHeader).toBeInTheDocument();
    expect(performanceHeader).toBeInTheDocument();

    // Reading order matches the requested desktop rows and single-column mobile flow.
    expect(
      Boolean(
        productsHeader.compareDocumentPosition(performanceHeader) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(
      Boolean(
        performanceHeader.compareDocumentPosition(providersHeader) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
  });

  it("renders product count and authoritative availability without numeric inventory", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Disponible: 1")).toBeInTheDocument();
    });

    // Main count: 3 productos
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("productos")).toBeInTheDocument();

    // 3 Stock badges
    expect(screen.getByText("Disponible: 1")).toBeInTheDocument();
    expect(screen.getByText("No disponible: 1")).toBeInTheDocument();
    expect(screen.getByText("Por confirmar: 1")).toBeInTheDocument();

    // Inventory value and its divider are removed
    expect(screen.queryByText(/Valor inventario/i)).not.toBeInTheDocument();

    // Availability label is removed
    expect(screen.getByText("Disponibilidad de productos activos")).toBeInTheDocument();
    expect(screen.queryByText(/98\.4%/i)).not.toBeInTheDocument();
  });

  it("renders supply chain card with active and inactive provider chips without big 2 number and without bottom labels", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("kpi-providers-active-chip")).toHaveTextContent("1 Proveedor activo");
    });

    // Active and inactive chips
    expect(screen.getByTestId("kpi-providers-active-chip")).toHaveTextContent("1 Proveedor activo");
    expect(screen.getByTestId("kpi-providers-inactive-chip")).toHaveTextContent("1 Proveedor inactivo");

    // Bottom labels removed
    expect(screen.queryByText(/Gasto promedio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Top: Proveedor Central/i)).not.toBeInTheDocument();
  });

  it("renders commercial performance card with sum of invoices of current month without status badge and without pending/link footer", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("kpi-invoiced-current-month")).toHaveTextContent(currentMonthTotal);
    });

    // Only current month invoice (50000), not past (100000)
    expect(screen.getByTestId("kpi-invoiced-current-month")).toHaveTextContent(currentMonthTotal);

    // State chip removed
    expect(screen.queryByText(/% cobrado/i)).not.toBeInTheDocument();

    // Pending collection and link in footer removed from KPI card
    expect(screen.queryByText(/Pendiente de cobro/i)).not.toBeInTheDocument();
  });

  it("renders recent invoices using standard table columns and max 10 records", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("FAC-CURRENT")).toBeInTheDocument();
    });

    // Check standard table headers
    expect(screen.getByText("Código / Folio")).toBeInTheDocument();
    expect(screen.getByText("Proveedor")).toBeInTheDocument();
    expect(screen.getByText("Monto Total")).toBeInTheDocument();
    expect(screen.getByText("Fecha de la factura")).toBeInTheDocument();
    expect(screen.getByText("Ruta / Archivo")).toBeInTheDocument();
    expect(screen.getByText("Visualizar archivo")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Activo" })).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();

    // Invoices are rendered
    expect(screen.getByText("FAC-CURRENT")).toBeInTheDocument();
    expect(screen.getByText("FAC-PAST")).toBeInTheDocument();
  });

  it("renders active providers without deriving inventory percentages", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("key-provider-progress-prov-1")).toBeInTheDocument();
    });

    // Active provider Distribuidora Central owns 20 of 20 total stock (100%)
    const provProgress = screen.getByTestId("key-provider-progress-prov-1");
    expect(provProgress).toHaveTextContent("Distribuidora Central");
    expect(provProgress).toHaveTextContent("Activo");
    expect(provProgress).not.toHaveTextContent("100%");

    // Inactive provider (prov-2) should not appear in active providers progress bars
    expect(screen.queryByTestId("key-provider-progress-prov-2")).not.toBeInTheDocument();
  });

  it("does not render Top Products, Quick Actions or Financial Alerts", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Catálogo de Productos")).toBeInTheDocument();
    });

    // Top Products is completely removed
    expect(screen.queryByText("Top Productos con Mayor Movimiento")).not.toBeInTheDocument();

    // Quick Actions & Financial Alerts are removed
    expect(screen.queryByText("Acciones Rápidas")).not.toBeInTheDocument();
    expect(screen.queryByText("Emitir Nueva Factura")).not.toBeInTheDocument();
    expect(screen.queryByText("Salud Financiera & Alertas")).not.toBeInTheDocument();
  });

  it("renders scrollable containers for recent invoices and key providers, and shows progress bar explanation caption", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("recent-invoices-scroll-panel")).toBeInTheDocument();
    });

    // Scroll containers exist
    expect(screen.getByTestId("recent-invoices-scroll-panel")).toBeInTheDocument();
    expect(screen.getByTestId("key-providers-scroll-panel")).toBeInTheDocument();

    // Explanation message is displayed in key providers panel
    const explanation = screen.getByTestId("key-providers-explanation");
    expect(explanation).toBeInTheDocument();
    expect(explanation).toHaveTextContent(
      "Proveedores activos del negocio. No se calcula inventario numérico."
    );
  });

  it("renders month selector in commercial performance KPI, allowing user to switch months and update total", async () => {
    renderOverviewTab(
      <OverviewTab
        businessId="biz-123"
        onSwitchTab={vi.fn()}
        onOpenNewProvider={vi.fn()}
        onOpenNewProduct={vi.fn()}
        onOpenNewInvoice={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("kpi-invoiced-current-month")).toHaveTextContent(currentMonthTotal);
    });

    // The select should contain available months (including 2024-01 from FAC-PAST)
    const selectContainer = screen.getByTestId("kpi-invoices-month-select");
    const nativeInput = selectContainer.querySelector("input") || selectContainer;
    
    // Change selected month to 2024-01
    fireEvent.change(nativeInput, { target: { value: "2024-01" } });

    // Amount updates to 100000 (from FAC-PAST), using the host's number locale.
    expect(screen.getByTestId("kpi-invoiced-current-month")).toHaveTextContent(pastMonthTotal);
  });
  it("does not present a partial page as inventory or monthly totals", async () => {
    vi.mocked(businessServices.getProducts).mockResolvedValue({ data: mockProducts, meta: { total_items: 100, page: 1, limit: 50, total_pages: 2 } });
    vi.mocked(businessServices.getInvoices).mockResolvedValue({ data: mockInvoices, meta: { total_items: 101, page: 1, limit: 50, total_pages: 3 } });
    renderOverviewTab(<OverviewTab businessId="biz-123" />);
    await waitFor(() => expect(screen.getByTestId("kpi-invoiced-current-month")).toHaveTextContent("—"));
    expect(screen.queryByTestId("kpi-stock-normal-chip")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Los indicadores completos no están disponibles");
  });
  it("requests the ten latest active invoices before pagination and excludes historical inactive records", async () => {
    vi.mocked(businessServices.getInvoices).mockResolvedValue({ data: [...mockInvoices, { ...mockInvoices[0], id: "inactive-1", code: "INACTIVE-HISTORICAL", is_active: false }], meta: { page: 1, limit: 10, total_items: 3, total_pages: 1 } });
    renderOverviewTab(<OverviewTab businessId="biz-123" />);
    await waitFor(() => expect(businessServices.getInvoices).toHaveBeenCalledWith({ page: 1, limit: 10, q: { business_id_eq: "biz-123", is_active_eq: true, s: "created_at desc" } }));
    expect(screen.queryByText("INACTIVE-HISTORICAL")).not.toBeInTheDocument();
  });

});
