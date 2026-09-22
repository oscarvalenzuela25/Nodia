import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ProductsTab from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/ProductsTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { ProductEntity, ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

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
        meta: { total_items: 2, page: params?.page ?? 1, limit: 50, total_pages: 1 },
      };
    });
  });

  it("renders table with columns, product data and calls getProducts with 50 limit and page 1 by default", async () => {
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
    expect(businessServices.getProducts).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      q: {
        business_id_eq: "biz-123",
        name_cont: undefined,
      },
    });

    // Verify default pagination rows per page is 50
    expect(screen.getByText("50")).toBeInTheDocument();
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
          limit: 50,
          total_pages: 3,
        },
      };
    });

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    expect(screen.getByText(/1[–-]50\s+(de|of)\s+110/i)).toBeInTheDocument();

    const nextPageBtn = screen.getByRole("button", { name: /siguiente|next/i });
    expect(nextPageBtn).toBeEnabled();

    await user.click(nextPageBtn);

    await waitFor(() => {
      expect(businessServices.getProducts).toHaveBeenCalledWith({
        page: 2,
        limit: 50,
        q: {
          business_id_eq: "biz-123",
          name_cont: undefined,
        },
      });
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
      expect(businessServices.getProducts).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        q: {
          business_id_eq: "biz-123",
          name_cont: "Café",
        },
      });
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

    // Re-open filter modal
    await user.click(screen.getByRole("button", { name: /abrir filtros|filtro/i }));
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
});
