import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ProductsTab from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/ProductsTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { ProductEntity, ProviderEntity, ProductLogEntity } from "../../../../../../../modules/business/infrastructure/types";
import { sileo } from "sileo";

vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductImageModal", () => ({
  default: ({ product, businessId, onClose }: { product: ProductEntity; businessId: string; onClose: () => void }) => <div role="dialog" aria-label="Image viewer boundary"><span>{businessId}:{product.id}</span><button onClick={onClose}>Close image viewer</button></div>,
}));

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
    tax: 19, use_ocr: false,
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


const mockMobile = () => vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
  matches: query.includes("599.95"), media: query, onchange: null,
  addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

describe("ProductsTab Component", () => {
  it("applies independent code-presence filters, restores their applied choices and clears them without changing activity defaults", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);
    await screen.findByText("Café de Especialidad 250g");
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    expect(screen.queryByRole("button", { name: "Código del producto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disponibilidad" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar código de factura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar código de barras" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Código de factura" }));
    await user.click(screen.getByRole("option", { name: "Sin código" }));
    expect(screen.queryByRole("button", { name: "Buscar código de factura" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Código de barras" }));
    await user.click(screen.getByRole("option", { name: "Con código" }));
    await user.click(screen.getByRole("button", { name: /^Filtrar$/i }));
    await waitFor(() => expect(businessServices.getProducts).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, limit: 25, q: expect.objectContaining({ code_presence: "missing", barcode_presence: "present", is_active_eq: true }),
    })));
    await user.click(await screen.findByRole("button", { name: "Abrir filtros" }));
    expect(screen.getByRole("button", { name: "Código de factura" })).toHaveTextContent("Sin código");
    expect(screen.getByRole("button", { name: "Código de barras" })).toHaveTextContent("Con código");
    await user.click(screen.getByRole("button", { name: /Limpiar filtros/i }));
    await waitFor(() => expect(businessServices.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1, limit: 25, q: expect.objectContaining({ code_presence: undefined, barcode_presence: undefined, is_active_eq: true }),
    })));
    expect(screen.queryByText("Código de barras: Con código")).not.toBeInTheDocument();
  });

  it("searches both code fields on demand, applies exact values and discards canceled changes", async () => {
    const invoiceCode = "0007,A";
    const barcode = "0012345";
    const product = { ...mockProducts[0], code: invoiceCode, barcode };
    vi.mocked(businessServices.getProducts).mockResolvedValue({
      data: [product],
      meta: { total_items: 1, page: 1, limit: 25, total_pages: 1 },
    });
    const lookupCalls = () => vi.mocked(businessServices.getProducts).mock.calls
      .map(([params]) => params).filter((params) => params?.includes === false);
    renderWithClient(<ProductsTab businessId="biz-123" />);
    await screen.findByText(product.name);
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));

    const invoiceSearch = screen.getByRole("button", { name: "Buscar código de factura" });
    await user.click(invoiceSearch);
    expect(screen.getByText("Escribe parte del código para buscar.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(lookupCalls()).toEqual([]);
    await user.type(screen.getByRole("textbox", { name: "Buscar código de factura" }), "7,A");
    const invoiceOption = await screen.findByRole("option", { name: invoiceCode });
    await user.keyboard("{ArrowDown}");
    expect(invoiceOption).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(invoiceSearch).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Código de barras" }));
    await user.click(screen.getByRole("option", { name: "Con código" }));
    await user.click(screen.getByRole("button", { name: "Buscar código de barras" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar código de barras" }), "0012");
    await user.click(await screen.findByRole("option", { name: barcode }));
    expect(lookupCalls().map((params) => params?.q)).toEqual([
      expect.objectContaining({ business_id_eq: "biz-123", code_cont: "7,A" }),
      expect.objectContaining({ business_id_eq: "biz-123", barcode_cont: "0012" }),
    ]);
    await user.click(screen.getByRole("button", { name: /^Filtrar$/i }));
    await waitFor(() => expect(businessServices.getProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, q: expect.objectContaining({
        code_eq: invoiceCode, barcode_eq: barcode, barcode_presence: "present", is_active_eq: true,
      }) }),
    ));
    await user.click(await screen.findByRole("button", { name: "Abrir filtros" }));
    await user.click(screen.getByRole("button", { name: "Código de barras" }));
    await user.click(screen.getByRole("option", { name: "Sin código" }));
    expect(screen.queryByRole("button", { name: "Buscar código de barras" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(await screen.findByRole("button", { name: "Abrir filtros" }));
    expect(screen.getByRole("button", { name: "Buscar código de factura" })).toHaveTextContent(invoiceCode);
    expect(screen.getByRole("button", { name: "Buscar código de barras" })).toHaveTextContent(barcode);

    await user.click(screen.getByRole("button", { name: "Código de barras" }));
    await user.click(screen.getByRole("option", { name: "Sin código" }));
    await user.click(screen.getByRole("button", { name: /^Filtrar$/i }));
    await waitFor(() => expect(businessServices.getProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, q: expect.objectContaining({
        code_eq: invoiceCode, barcode_eq: undefined, barcode_presence: "missing",
      }) }),
    ));
  });
  it("opens the image column viewer for the selected product and keeps the name cell free of thumbnails", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);
    expect(await screen.findByRole("columnheader", { name: "Imagen" })).toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /Café de Especialidad 250g/ });
    const nameCell = within(row).getByRole("cell", { name: "Café de Especialidad 250g" });
    expect(within(nameCell).queryByRole("img")).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ver imagen de Café de Especialidad 250g" }));
    expect(screen.getByRole("dialog", { name: "Image viewer boundary" })).toHaveTextContent(`biz-123:${mockProducts[0].id}`);
    await user.click(screen.getByRole("button", { name: "Close image viewer" }));
    expect(screen.queryByRole("dialog", { name: "Image viewer boundary" })).not.toBeInTheDocument();
    expect(businessServices.updateProduct).not.toHaveBeenCalled();
    expect(businessServices.createProduct).not.toHaveBeenCalled();
  });
  it("shows the loaded thumbnail and enabled offer while retaining a name-only cell and the existing image viewer", async () => {
    const product = { ...mockProducts[0], barcode: "00001234", offer_price: 9000, is_offer_enabled: true,
      image: { id: "image-1", url: "https://example.test/synthetic.jpg", mime_type: "image/jpeg", width: 400, height: 300, byte_size: 1024 } };
    vi.mocked(businessServices.getProducts).mockResolvedValue({ data: [product], meta: { total_items: 1, page: 1, limit: 25, total_pages: 1 } });
    renderWithClient(<ProductsTab businessId="biz-123" />);
    const row = await screen.findByRole("row", { name: /Café de Especialidad 250g/ });
    const nameCell = within(row).getByText(product.name).closest("td")!;
    expect(nameCell).toHaveTextContent(/^Café de Especialidad 250g$/);
    expect(within(row).queryByText(product.barcode)).not.toBeInTheDocument();
    expect(within(row).getByText("Oferta: $9.000 x unidad")).toBeInTheDocument();
    expect(within(row).getByText("Normal: $8.330 x unidad")).toBeInTheDocument();
    expect(within(row).getByAltText("")).toHaveAttribute("src", product.image.url);
    await user.click(within(row).getByRole("button", { name: `Ver imagen de ${product.name}` }));
    expect(screen.getByRole("dialog", { name: "Image viewer boundary" })).toHaveTextContent(`biz-123:${product.id}`);
    expect(businessServices.updateProduct).not.toHaveBeenCalled();
    expect(businessServices.createProduct).not.toHaveBeenCalled();
  });
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProducts.forEach((product) => { product.previous_price_snapshot = null; });
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

    // Additional status columns start collapsed without losing the product data.
    expect(screen.queryByRole("columnheader", { name: "Última actualización" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Disponibilidad" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
    expect(screen.queryByText("Por confirmar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stock-dot-prod-2")).not.toBeInTheDocument();

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

  it("toggles the two additional columns for current and expanded historical rows without refetching or replacing actions", async () => {
    mockProducts[0].previous_price_snapshot = mockProductLogs[1];
    renderWithClient(<ProductsTab businessId="biz-123" />);
    const row = await screen.findByRole("row", { name: /Café de Especialidad 250g/ });
    const nameCell = within(row).getByText(mockProducts[0].name).closest("td");
    const actions = within(row).getByTestId("product-actions-btn-prod-1");
    const expand = within(row).getByTestId("expand-product-btn-prod-1");
    await user.click(expand);
    const historical = screen.getByTestId("historical-row-prod-1");
    expect(within(row).getAllByRole("cell")).toHaveLength(10);
    expect(within(historical).getAllByRole("cell")).toHaveLength(10);
    const reads = vi.mocked(businessServices.getProducts).mock.calls.length;
    const historyReads = vi.mocked(businessServices.getProductLogs).mock.calls.length;
    const toggle = screen.getByRole("button", { name: "Mostrar última actualización y estado" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Ocultar última actualización y estado");
    expect(toggle).toHaveFocus();
    expect(screen.queryByRole("columnheader", { name: "Disponibilidad" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Última actualización" }).nextElementSibling)
      .toBe(screen.getByRole("columnheader", { name: "Estado" }));
    expect(within(row).getAllByRole("cell")).toHaveLength(12);
    expect(within(historical).getAllByRole("cell")).toHaveLength(12);
    expect(within(row).getByText(mockProducts[0].name).closest("td")).toBe(nameCell);
    expect(within(row).getByTestId("product-actions-btn-prod-1")).toBe(actions);
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(row).getAllByRole("cell")).toHaveLength(10);
    expect(within(historical).getAllByRole("cell")).toHaveLength(10);
    expect(screen.getByTestId("historical-row-prod-1")).toBe(historical);
    expect(within(row).getByTestId("product-actions-btn-prod-1")).toBe(actions);
    expect(businessServices.getProducts).toHaveBeenCalledTimes(reads);
    expect(businessServices.getProductLogs).toHaveBeenCalledTimes(historyReads);
    expect(businessServices.createProduct).not.toHaveBeenCalled();
    expect(businessServices.updateProduct).not.toHaveBeenCalled();
  });

  it("shows barcode presence directly before the invoice code without exposing the barcode text", async () => {
    vi.mocked(businessServices.getProducts).mockResolvedValue({
      data: [{ ...mockProducts[0], barcode: "0012345" }, { ...mockProducts[1], barcode: null }],
      meta: { total_items: 2, page: 1, limit: 25, total_pages: 1 },
    });
    renderWithClient(<ProductsTab businessId="biz-123" />);
    const withBarcode = await screen.findByRole("row", { name: /Café de Especialidad/ });
    const withoutBarcode = screen.getByRole("row", { name: /Té Matcha/ });
    const barcode = screen.getByRole("columnheader", { name: "Código de barras" });
    const invoiceCode = screen.getByRole("columnheader", { name: "Código de factura" });
    expect(barcode.nextElementSibling).toBe(invoiceCode);
    expect(within(withBarcode).getByRole("img", { name: "Tiene código de barras" })).toBeInTheDocument();
    expect(within(withoutBarcode).getByRole("img", { name: "Sin código de barras" })).toBeInTheDocument();
    expect(screen.queryByText("0012345")).not.toBeInTheDocument();
  });

  it("keeps the empty row spanning the visible table columns when additional headers toggle", async () => {
    vi.mocked(businessServices.getProducts).mockResolvedValue({ data: [], meta: { total_items: 0, page: 1, limit: 25, total_pages: 0 } });
    renderWithClient(<ProductsTab businessId="biz-123" />);
    const toggle = await screen.findByRole("button", { name: "Mostrar última actualización y estado" });
    const empty = screen.getByRole("cell");
    expect(empty).toHaveAttribute("colspan", "10");
    expect(screen.getAllByRole("columnheader")).toHaveLength(10);
    await user.click(toggle);
    expect(empty).toHaveAttribute("colspan", "12");
    expect(screen.getAllByRole("columnheader")).toHaveLength(12);
    await user.click(toggle);
    expect(empty).toHaveAttribute("colspan", "10");
    expect(screen.getAllByRole("columnheader")).toHaveLength(10);
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
            search: "Café",
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
    const filterBtn = screen.getByRole("button", { name: /^abrir filtros/i });
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
    const filterBtn = screen.getByRole("button", { name: /^abrir filtros/i });
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
    mockProducts[0].previous_price_snapshot = mockProductLogs[1];
    mockProducts[1].previous_price_snapshot = mockProductLogs[3];
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

  it("offers increases and decreases as price filters and sends the selected variation", async () => {
    mockProducts[0].previous_price_snapshot = mockProductLogs[1];
    mockProducts[1].previous_price_snapshot = mockProductLogs[3];
    vi.mocked(businessServices.getProductLogs).mockResolvedValue({
      data: mockProductLogs,
      meta: { total_items: 4, page: 1, limit: 100, total_pages: 1 },
    });

    renderWithClient(<ProductsTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Café de Especialidad 250g")).toBeInTheDocument();
    });

    // Open filter modal
    const filterBtn = screen.getByRole("button", { name: /^abrir filtros/i });
    await user.click(filterBtn);

    await waitFor(() => {
      expect(screen.getByText("Filtros de productos")).toBeInTheDocument();
    });

    // Click on the price change selector
    const priceChangeSelect = screen.getByRole("button", { name: /Variación de precio/i });
    await user.click(priceChangeSelect);

    const options = within(await screen.findByRole("listbox"));
    expect(options.getAllByRole("menuitem")).toHaveLength(2);
    expect(options.getByRole("menuitem", { name: "Bajó de precio" })).toBeInTheDocument();
    const optionIncreased = options.getByRole("menuitem", { name: "Subió de precio" });
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
  it("queries active records by default and restores that default after clearing filters", async () => {
    renderWithClient(<ProductsTab businessId="biz-123" />);
    await waitFor(() => expect(businessServices.getProducts).toHaveBeenCalledWith(expect.objectContaining({ q: expect.objectContaining({ is_active_eq: true }) })));
    await user.click(screen.getByRole("button", { name: /^abrir filtros/i }));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(businessServices.getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ q: expect.objectContaining({ is_active_eq: true }) }));
  });

  it("shows mobile product cards with the same historical comparison and edit target", async () => {
    mockMobile();
    mockProducts[0].previous_price_snapshot = mockProductLogs[1];
    mockProducts[1].previous_price_snapshot = mockProductLogs[3];
    vi.mocked(businessServices.getProductLogs).mockResolvedValue({ data: mockProductLogs, meta: { page: 1, limit: 100, total_items: mockProductLogs.length, total_pages: 1 } });
    renderWithClient(<ProductsTab businessId="biz-123" />);
    const card = await screen.findByRole("article", { name: "Café de Especialidad 250g" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(await within(card).findByRole("button", { name: /histórico/i }));
    expect(await screen.findByRole("article", { name: /Histórico.*Antiguo/ })).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /Acciones de/ }));
    await user.click(screen.getByRole("menuitem", { name: "Actualizar" }));
    expect(await screen.findByRole("textbox", { name: /^Nombre del Producto/ })).toHaveValue("Café de Especialidad 250g");
  });

});
