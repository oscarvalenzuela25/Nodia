import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ProductsTab from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/ProductsTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { ProductEntity, ProviderEntity, ProductLogEntity } from "../../../../../../../modules/business/infrastructure/types";
import { sileo } from "sileo";

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
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  getProviders: vi.fn(),
  exportProductsCsv: vi.fn(),
  getProductLogs: vi.fn(),
}));

const mockProductLogs: ProductLogEntity[] = [
  {
    id: "log-1",
    product_id: "prod-1",
    code: "PROD-001",
    name: "Café de Especialidad 250g",
    cost_price: 5000,
    cost_price_tax: 5950,
    profit_percentage: 40,
    sale_price: 8330,
    stock: 25,
    created_at: "2026-09-20T14:30:00Z",
    updated_at: "2026-09-20T14:30:00Z",
  },
  {
    id: "log-2",
    product_id: "prod-1",
    code: "PROD-001-OLD",
    name: "Café de Especialidad 250g Antiguo",
    cost_price: 4000,
    cost_price_tax: 4760,
    profit_percentage: 30,
    sale_price: 6188,
    stock: 15,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "log-3",
    product_id: "prod-2",
    code: "PROD-002",
    name: "Té Matcha Premium",
    cost_price: 12000,
    cost_price_tax: 14280,
    profit_percentage: 35,
    sale_price: 19278,
    stock: 5,
    created_at: "2026-09-21T10:15:00Z",
    updated_at: "2026-09-21T10:15:00Z",
  },
  {
    id: "log-4",
    product_id: "prod-2",
    code: "PROD-002",
    name: "Té Matcha Premium Anterior",
    cost_price: 15000,
    cost_price_tax: 17850,
    profit_percentage: 40,
    sale_price: 24990,
    stock: 10,
    created_at: "2026-07-15T09:00:00Z",
    updated_at: "2026-07-15T09:00:00Z",
  },
];

const mockProviders: ProviderEntity[] = [
  {
    id: "prov-1",
    business_id: "biz-123",
    name: "Distribuidora Central",
    tax: 19,
    is_active: true,
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
    profit_percentage: 40,
    sale_price: 8330,
    stock: 25,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-09-20T14:30:00Z",
    provider: mockProviders[0],
  },
  {
    id: "prod-2",
    business_id: "biz-123",
    provider_id: null,
    code: "PROD-002",
    name: "Té Matcha Premium",
    cost_price: 12000,
    cost_price_tax: 14280,
    profit_percentage: 35,
    sale_price: 19278,
    stock: 5,
    is_active: false,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-09-21T10:15:00Z",
  },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

const renderWithClient = (ui: ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe("ProductsTab Component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = vi.fn();
    vi.mocked(businessServices.exportProductsCsv).mockResolvedValue("Code (code),Name (name)\nPROD-001,Café");
    vi.mocked(businessServices.getProductLogs).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 100, total_pages: 1 },
    });
    vi.mocked(businessServices.getProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 1, page: 1, limit: 100, total_pages: 1 },
    });
    vi.mocked(businessServices.getProducts).mockImplementation(async (params) => {
      if (params?.all) {
        return {
          data: mockProducts,
          meta: { total_items: 2, page: 1, limit: 100, total_pages: 1 },
        };
      }
      return {
        data: mockProducts,
        meta: { total_items: 2, page: params?.page ?? 1, limit: 25, total_pages: 1 },
      };
    });
  });

  it("renders table with columns, product data and calls getProducts with 25 limit and page 1 by default", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    expect(screen.getByText("PROD-001")).toBeInTheDocument();
    expect(screen.getByText("Distribuidora Central")).toBeInTheDocument();
    expect(screen.getByText("Té Matcha Premium")).toBeInTheDocument();

    // Verify Costo Base con Impuestos header and cost values
    expect(screen.getByText("Costo Base con Impuestos")).toBeInTheDocument();
    expect(screen.getByText(/\$5[.,\s]?950/)).toBeInTheDocument();
    expect(screen.getByText(/\$14[.,\s]?280/)).toBeInTheDocument();

    // Verify Última actualización header
    expect(screen.getByText("Última actualización")).toBeInTheDocument();

    // Verify stock dots
    expect(screen.getByTestId("stock-dot-prod-1")).toBeInTheDocument();
    expect(screen.getByTestId("stock-dot-prod-2")).toBeInTheDocument();

    // Verify initial call to getProducts with table pagination params
    expect(businessServices.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 25,
        q: expect.objectContaining({
          business_id_eq: "biz-123",
          s: "created_at desc",
        }),
      })
    );

    // Verify default pagination rows per page is 25
    expect(screen.getByRole("combobox")).toHaveTextContent("25");
    expect(screen.getByText(/1–2 de 2|1–2 of 2/i)).toBeInTheDocument();
  });

  it("paginates products and requests new page when clicking next page button", async () => {
    vi.mocked(businessServices.getProducts).mockImplementation(async (params) => {
      if (params?.all) {
        return {
          data: mockProducts,
          meta: { total_items: 2, page: 1, limit: 100, total_pages: 1 },
        };
      }
      return {
        data: mockProducts,
        meta: {
          total_items: 110,
          page: params?.page ?? 1,
          limit: 25,
          total_pages: 5,
        },
      };
    });

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    expect(screen.getByText(/1[–-]25\s+(de|of)\s+110/i)).toBeInTheDocument();

    const nextPageBtn = screen.getByRole("button", { name: /siguiente|next/i });
    expect(nextPageBtn).toBeEnabled();

    await user.click(nextPageBtn);

    await waitFor(() => {
      expect(businessServices.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 25,
          q: expect.objectContaining({
            business_id_eq: "biz-123",
            s: "created_at desc",
          }),
        })
      );
    });
  });

  it("resets page to 0 when search term is entered", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/buscar/i);
    await user.type(searchInput, "Café");

    await waitFor(() => {
      expect(businessServices.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 25,
          q: expect.objectContaining({
            business_id_eq: "biz-123",
            name_cont: "Café",
            s: "created_at desc",
          }),
        })
      );
    });
  });

  it("opens 3-dots action menu with Actualizar and Desactivar options, and opens edit modal on click", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    const actionBtn = screen.getByTestId("product-actions-btn-prod-1");
    await user.click(actionBtn);

    expect(screen.getByTestId("menu-item-edit-product")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-toggle-product")).toBeInTheDocument();
    expect(screen.getByText(/Desactivar/i)).toBeInTheDocument();

    await user.click(screen.getByTestId("menu-item-edit-product"));
    await waitFor(() => {
      expect(screen.getByText(/Editar Producto/i)).toBeInTheDocument();
    });
  });

  it("opens confirm dialog when clicking toggle in 3-dots menu and calls updateProduct on confirm", async () => {
    vi.mocked(businessServices.updateProduct).mockResolvedValue({
      ...mockProducts[0],
      is_active: false,
    });

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    const actionBtn = screen.getByTestId("product-actions-btn-prod-1");
    await user.click(actionBtn);

    await user.click(screen.getByTestId("menu-item-toggle-product"));

    await waitFor(() => {
      expect(screen.getByText("¿Desactivar producto?")).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /Desactivar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(businessServices.updateProduct).toHaveBeenCalledWith("prod-1", {
        is_active: false,
      });
    });
  });

  it("opens filter modal, allows entering filters, and renders FilterChips when applied", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    // Click filter trigger button (badge or trigger)
    const filterBtn = screen.getByRole("button", { name: /abrir filtros|filtro/i });
    await user.click(filterBtn);

    await waitFor(() => {
      expect(screen.getByText("Filtros de productos")).toBeInTheDocument();
    });

    // Enter product name filter
    const filterNameInput = screen.getByTestId("filter-product-name-input").querySelector("input");
    expect(filterNameInput).toBeInTheDocument();
    if (filterNameInput) {
      await user.type(filterNameInput, "Matcha");
    }

    // Click Filtrar button in modal footer
    const applyBtn = screen.getByRole("button", { name: /^filtrar$/i });
    await user.click(applyBtn);

    // Verify filter chip is displayed
    await waitFor(() => {
      expect(screen.getByText(/Nombre:\s*Matcha/i)).toBeInTheDocument();
    });

    // Verify getProducts was called with filter query
    expect(businessServices.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.objectContaining({
          name_cont: "Matcha",
        }),
      })
    );
  });

  it("clears filters when clicking Limpiar filtros in filter modal", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    // Open filter modal
    const filterBtn = screen.getByRole("button", { name: /abrir filtros|filtro/i });
    await user.click(filterBtn);

    await waitFor(() => {
      expect(screen.getByText("Filtros de productos")).toBeInTheDocument();
    });

    // Enter product name filter
    const filterNameInput = screen.getByTestId("filter-product-name-input").querySelector("input");
    if (filterNameInput) {
      await user.type(filterNameInput, "Matcha");
    }

    // Apply
    const applyBtn = screen.getByRole("button", { name: /^filtrar$/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Nombre:\s*Matcha/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Re-open filter modal
    const reopenFilterBtn = await screen.findByRole("button", { name: /abrir filtros/i });
    await user.click(reopenFilterBtn);
    await waitFor(() => {
      expect(screen.getByText("Filtros de productos")).toBeInTheDocument();
    });

    // Click Limpiar filtros
    const clearBtn = screen.getByRole("button", { name: /limpiar filtros/i });
    await user.click(clearBtn);

    // Filter chip should be removed
    await waitFor(() => {
      expect(screen.queryByText(/Nombre:\s*Matcha/i)).not.toBeInTheDocument();
    });
  });

  it("opens download CSV menu and triggers client-side download for current view", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    const downloadBtn = screen.getByTestId("download-products-csv-btn");
    await user.click(downloadBtn);

    const currentViewOption = await screen.findByTestId("menu-download-current-view");
    expect(currentViewOption).toBeInTheDocument();

    await user.click(currentViewOption);

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
      })
    );
  });

  it("opens download CSV menu and calls exportProductsCsv to download all data", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    const downloadBtn = screen.getByTestId("download-products-csv-btn");
    await user.click(downloadBtn);

    const allDataOption = await screen.findByTestId("menu-download-all");
    expect(allDataOption).toBeInTheDocument();

    await user.click(allDataOption);

    await waitFor(() => {
      expect(businessServices.exportProductsCsv).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: "biz-123",
        })
      );
    });
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
      })
    );
  });

  it("shows warning toast when downloading current view with empty products", async () => {
    vi.mocked(businessServices.getProducts).mockImplementation(async () => ({
      data: [],
      meta: { total_items: 0, page: 1, limit: 25, total_pages: 0 },
    }));

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.queryByText("Café de Especialidad 250g")).not.toBeInTheDocument();
    });

    const downloadBtn = screen.getByTestId("download-products-csv-btn");
    await user.click(downloadBtn);

    const currentViewOption = await screen.findByTestId("menu-download-current-view");
    await user.click(currentViewOption);

    expect(sileo.warning).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.any(String),
      })
    );
  });

  it("renders expand icon, price variation indicators, and toggles historical sub-row", async () => {
    vi.mocked(businessServices.getProductLogs).mockResolvedValue({
      data: mockProductLogs,
      meta: { total_items: 4, page: 1, limit: 100, total_pages: 1 },
    });

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    // Check that price diff badges are rendered
    await waitFor(() => {
      expect(screen.getByTestId("price-diff-prod-1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("price-diff-prod-1")).toHaveTextContent("+34%");
    expect(screen.getByTestId("price-diff-prod-2")).toBeInTheDocument();
    expect(screen.getByTestId("price-diff-prod-2")).toHaveTextContent("-22%");

    // Expand button should exist for prod-1
    const expandBtn = screen.getByTestId("expand-product-btn-prod-1");
    expect(expandBtn).toBeInTheDocument();

    // Initially historical row is not rendered
    expect(screen.queryByTestId("historical-row-prod-1")).not.toBeInTheDocument();

    // Click to expand
    await user.click(expandBtn);

    // Now historical row is visible
    await waitFor(() => {
      expect(screen.getByTestId("historical-row-prod-1")).toBeInTheDocument();
    });

    // Check historical values inside sub-row
    expect(screen.getByText("PROD-001-OLD")).toBeInTheDocument();
    expect(screen.getByText("Café de Especialidad 250g Antiguo")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByText(/\$4[.,\s]?760/)).toBeInTheDocument();
    expect(screen.getByText(/\$6[.,\s]?188/)).toBeInTheDocument();

    // Click again to collapse
    await user.click(expandBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("historical-row-prod-1")).not.toBeInTheDocument();
    });
  });

  it("filters products by price change status (increased, decreased, unchanged)", async () => {
    vi.mocked(businessServices.getProductLogs).mockResolvedValue({
      data: mockProductLogs,
      meta: { total_items: 4, page: 1, limit: 100, total_pages: 1 },
    });

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    // Open filter modal
    const filterBtn = screen.getByRole("button", { name: /abrir filtros|filtro/i });
    await user.click(filterBtn);

    await waitFor(() => {
      expect(screen.getByText("Filtros de productos")).toBeInTheDocument();
    });

    // Click on the price change selector
    const priceChangeSelect = screen.getByRole("button", { name: /Variación de precio/i });
    await user.click(priceChangeSelect);

    // Option "Subió de precio" should be visible
    const optionIncreased = await screen.findByText("Subió de precio");
    await user.click(optionIncreased);

    // Close select dropdown
    await user.keyboard("{Escape}");

    // Click on "Filtrar"
    const applyBtn = screen.getByRole("button", { name: /^filtrar$/i });
    await user.click(applyBtn);

    // Chip should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Variación:\s*Subió de precio/i)).toBeInTheDocument();
    });

    // getProducts called with price_change_in: ["increased"]
    expect(businessServices.getProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.objectContaining({
          price_change_in: ["increased"],
        }),
      })
    );
  });
});
