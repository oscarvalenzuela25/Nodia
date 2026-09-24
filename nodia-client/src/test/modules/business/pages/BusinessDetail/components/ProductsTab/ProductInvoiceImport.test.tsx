import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  ProductInvoiceImport,
  validateInvoiceRow,
  mapExtractedItemsToRows,
  calculatePriceDiff,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import useGeneralSettingsStore from "../../../../../../../store/generalSettings/generalSettingsStore";
import type {
  ProductEntity,
  ExtractedInvoiceItem,
  ProductLogEntity,
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
  getProviders: vi.fn().mockResolvedValue({
    data: [
      { id: "prov-1", name: "Distribuidora Central", business_id: "biz-123" },
    ],
    meta: { total_items: 1 },
  }),
  getProducts: vi.fn().mockResolvedValue({
    data: [
      {
        id: "prod-existing-1",
        business_id: "biz-123",
        code: "SKU-EXISTING",
        name: "Producto Existente",
        cost_price: 5000,
        cost_price_tax: 950,
        profit_percentage: 40,
        sale_price: 7000,
        stock: 10,
        is_active: true,
      },
    ],
    meta: { total_items: 1 },
  }),
  getProductLogs: vi.fn().mockResolvedValue({
    data: [],
    meta: { total_items: 0 },
  }),
  analyzeInvoice: vi.fn(),
  createInvoiceWithFile: vi.fn(),
  bulkCreateProducts: vi.fn(),
  bulkUpdateProducts: vi.fn(),
}));

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

describe("ProductInvoiceImport Helpers", () => {
  describe("validateInvoiceRow", () => {
    it("returns errors when required fields are missing or numbers are negative", () => {
      const result = validateInvoiceRow({
        code: "",
        name: "",
        cost_price: -100,
        cost_price_tax: -19,
        profit_percentage: -5,
        sale_price: -200,
        stock: -1,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Código es requerido");
      expect(result.errors).toContain("Nombre es requerido");
      expect(result.errors).toContain("Costo debe ser >= 0");
    });

    it("returns valid when all fields satisfy business rules", () => {
      const result = validateInvoiceRow({
        code: "SKU-TEST-1",
        name: "Mouse Gamer RGB",
        cost_price: 15000,
        cost_price_tax: 2850,
        profit_percentage: 30,
        sale_price: 19500,
        stock: 25,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("calculatePriceDiff", () => {
    it("returns null when currentSale or historicalSale is missing, zero or equal", () => {
      expect(calculatePriceDiff(0, 5000)).toBeNull();
      expect(calculatePriceDiff(5000, 0)).toBeNull();
      expect(calculatePriceDiff(5000, undefined)).toBeNull();
      expect(calculatePriceDiff(5000, 5000)).toBeNull();
    });

    it("calculates truncated positive percentage difference when price increased", () => {
      // (11590 - 10000) / 10000 = 15.9% -> truncated without decimals = 15%
      const result = calculatePriceDiff(11590, 10000);
      expect(result).toEqual({
        diff: 1590,
        percent: 15,
        isIncrease: true,
      });
    });

    it("calculates truncated negative percentage difference when price decreased", () => {
      // (9200 - 10000) / 10000 = -8.0% -> truncated without decimals = 8%
      const result = calculatePriceDiff(9200, 10000);
      expect(result).toEqual({
        diff: -800,
        percent: 8,
        isIncrease: false,
      });
    });
  });

  describe("mapExtractedItemsToRows", () => {
    const existingProducts: ProductEntity[] = [
      {
        id: "prod-existing-1",
        business_id: "biz-123",
        code: "SKU-EXISTING",
        name: "Producto Existente",
        cost_price: 5000,
        cost_price_tax: 950,
        profit_percentage: 40,
        sale_price: 7000,
        stock: 10,
        is_active: true,
      },
    ];

    it("matches existing products by code and sorts invalid rows strictly to the top", () => {
      const items: ExtractedInvoiceItem[] = [
        {
          code: "SKU-EXISTING",
          name: "Producto Existente Factura",
          quantity: 20,
          unit_price: 5500,
          total_price: 110000,
        },
        {
          code: "", // Missing code -> Invalid row!
          name: "Item Sin Codigo",
          quantity: 5,
          unit_price: 2000,
          total_price: 10000,
        },
        {
          code: "SKU-BRAND-NEW",
          name: "Nuevo Producto",
          quantity: 15,
          unit_price: 8000,
          total_price: 120000,
        },
      ];

      const rows = mapExtractedItemsToRows(items, existingProducts);

      expect(rows).toHaveLength(3);

      // Row at index 0 MUST be the invalid one!
      expect(rows[0].isValid).toBe(false);
      expect(rows[0].name).toBe("Item Sin Codigo");
      expect(rows[0].errors).toContain("Código es requerido");

      // Followed by valid rows
      expect(rows[1].isValid).toBe(true);
      expect(rows[2].isValid).toBe(true);

      // Check existing product matching
      const existingMatch = rows.find((r) => r.code === "SKU-EXISTING");
      expect(existingMatch).toBeDefined();
      expect(existingMatch?.id).toBe("prod-existing-1");
      expect(existingMatch?.isUpdate).toBe(true);
      expect(existingMatch?.cost_price).toBe(5500);
      expect(existingMatch?.stock).toBe(20);

      // Check new product
      const newMatch = rows.find((r) => r.code === "SKU-BRAND-NEW");
      expect(newMatch).toBeDefined();
      expect(newMatch?.id).toBeUndefined();
      expect(newMatch?.isUpdate).toBe(false);
    });

    it("handles cost_price_tax without cost_price without inventing cost_price", () => {
      const items: ExtractedInvoiceItem[] = [
        {
          code: "SKU-TAX-ONLY",
          name: "Producto Solo Con Impuesto",
          quantity: 10,
          cost_price_tax: 5950,
          cost_price: null,
          total_price: 59500,
        },
      ];

      const rows = mapExtractedItemsToRows(items, []);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("SKU-TAX-ONLY");
      expect(rows[0].cost_price).toBe(0);
      expect(rows[0].cost_price_tax).toBe(5950);
      expect(rows[0].sale_price).toBe(Math.round(5950 * 1.3));
    });

    it("handles cost_price without cost_price_tax without inventing cost_price_tax", () => {
      const items: ExtractedInvoiceItem[] = [
        {
          code: "SKU-NET-ONLY",
          name: "Producto Solo Con Neto",
          quantity: 10,
          cost_price: 5000,
          cost_price_tax: null,
          total_price: 50000,
        },
      ];

      const rows = mapExtractedItemsToRows(items, []);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("SKU-NET-ONLY");
      expect(rows[0].cost_price).toBe(5000);
      expect(rows[0].cost_price_tax).toBe(0);
      expect(rows[0].sale_price).toBe(Math.round(5000 * 1.19 * 1.3));
    });

    it("handles code only with costs left at 0 and sale_price at 0", () => {
      const items: ExtractedInvoiceItem[] = [
        {
          code: "SKU-CODE-ONLY",
          name: "Producto Solo Con Código",
          quantity: 1,
          cost_price: null,
          cost_price_tax: null,
          total_price: null,
        },
      ];

      const rows = mapExtractedItemsToRows(items, []);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("SKU-CODE-ONLY");
      expect(rows[0].cost_price).toBe(0);
      expect(rows[0].cost_price_tax).toBe(0);
      expect(rows[0].sale_price).toBe(0);
      expect(rows[0].isValid).toBe(true);
    });

    it("synchronizes profit percentage with historical product and calculates price diff", () => {
      const items: ExtractedInvoiceItem[] = [
        {
          code: "SKU-HIST",
          name: "Producto Con Historico",
          quantity: 5,
          unit_price: 10000,
          total_price: 50000,
        },
      ];

      const historicalLogs: ProductLogEntity[] = [
        {
          id: "log-1",
          product_id: "prod-hist-1",
          code: "SKU-HIST",
          name: "Producto Antiguo",
          cost_price: 7000,
          cost_price_tax: 8330,
          profit_percentage: 50,
          sale_price: 12495,
          stock: 8,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const rows = mapExtractedItemsToRows(items, [], historicalLogs);
      expect(rows).toHaveLength(1);
      // Synchronized margin: 50% from log
      expect(rows[0].profit_percentage).toBe(50);
      // Cost tax: 10000 * 1.19 = 11900
      expect(rows[0].cost_price_tax).toBe(11900);
      // Sale price: 11900 * 1.50 = 17850
      expect(rows[0].sale_price).toBe(17850);
      // Historical product is populated
      expect(rows[0].historicalProduct).toBeDefined();
      expect(rows[0].historicalProduct?.sale_price).toBe(12495);
      // Price diff: (17850 - 12495) / 12495 = 42.8% -> truncated 42%
      expect(rows[0].priceDiff).toEqual({
        diff: 5355,
        percent: 42,
        isIncrease: true,
      });
      // Initial lock state is false
      expect(rows[0].isLocked).toBe(false);
    });

    it("handles full extraction under backend criteria where both cost_price and cost_price_tax are filled", () => {
      const items: ExtractedInvoiceItem[] = [
        {
          code: "SKU-FULL",
          name: "Producto Completo",
          quantity: 5,
          cost_price: 4000,
          cost_price_tax: 4760,
          total_price: 23800,
        },
      ];

      const rows = mapExtractedItemsToRows(items, []);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("SKU-FULL");
      expect(rows[0].cost_price).toBe(4000);
      expect(rows[0].cost_price_tax).toBe(4760);
      expect(rows[0].sale_price).toBe(Math.round(4760 * 1.3));
      expect(rows[0].isValid).toBe(true);
    });
  });
});

describe("ProductInvoiceImport Component", () => {
  const user = userEvent.setup();
  const mockOnCancel = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    useGeneralSettingsStore.setState({
      isLoaded: false,
      can_use_gemini: false,
      can_use_mistral: false,
      can_analyze_invoice: false,
    });
  });

  const selectProvider = async () => {
    const trigger = screen.getByRole("button", { name: /Proveedor vinculado/i });
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "Distribuidora Central" });
    await user.click(option);
  };

  it("allows searching providers in SelectSingleInput and does not render a none option", async () => {
    vi.mocked(businessServices.getProviders).mockResolvedValueOnce({
      data: [
        {
          id: "prov-1",
          name: "Distribuidora Central",
          business_id: "biz-123",
          tax: 19,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "prov-2",
          name: "Importadora Andes",
          business_id: "biz-123",
          tax: 19,
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: { total_items: 2, page: 1, limit: 100, total_pages: 1 },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    const trigger = screen.getByRole("button", { name: /Proveedor vinculado/i });
    await user.click(trigger);

    // Verify "None" / "Ninguno" option is NOT present
    expect(screen.queryByRole("option", { name: /none|ninguno/i })).not.toBeInTheDocument();

    // Verify search input filters options
    const searchInput = screen.getByPlaceholderText(/buscar proveedor|buscar/i);
    await user.type(searchInput, "Andes");

    expect(screen.getByRole("option", { name: "Importadora Andes" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Distribuidora Central" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "Importadora Andes" }));
    expect(screen.getByText("Importadora Andes")).toBeInTheDocument();
  });

  it("disables upload input and dropzone when no provider is selected", async () => {
    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;
    const dropzone = screen.getByTestId("invoice-dropzone");

    // Disabled initially
    expect(fileInput).toBeDisabled();
    expect(dropzone).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText(/Selecciona un proveedor para habilitar la carga de la factura/i)
    ).toBeInTheDocument();

    // Clicking dropzone does not trigger file input click
    const clickSpy = vi.spyOn(fileInput, "click");
    await user.click(dropzone);
    expect(clickSpy).not.toHaveBeenCalled();

    // Select provider
    await selectProvider();

    // Now enabled
    expect(fileInput).not.toBeDisabled();
    expect(dropzone).toHaveAttribute("aria-disabled", "false");
    expect(
      screen.getByText(/Haz clic o arrastra tu factura aquí/i)
    ).toBeInTheDocument();
  });

  it("renders upload area and triggers file selection", async () => {
    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText(/Crear \/ Actualizar productos desde Factura/i)).toBeInTheDocument();
    expect(screen.getByTestId("invoice-dropzone")).toBeInTheDocument();

    await selectProvider();

    const file = new File(["dummy content"], "factura_test.pdf", {
      type: "application/pdf",
    });
    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(screen.getByText(/Factura cargada: factura_test.pdf/i)).toBeInTheDocument();
    expect(screen.getByTestId("analyze-invoice-btn")).toBeInTheDocument();
  });

  it("analyzes invoice, displays provisional table with red dot sorted to top and blocks save", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-9988",
      total_amount: 150000,
      data: {
        issue_date: "2026-03-20",
        items: [
          {
            code: "SKU-VALID-1",
            name: "Cable HDMI 4K",
            quantity: 10,
            unit_price: 3000,
            total_price: 30000,
          },
          {
            code: "", // Missing code!
            name: "Adaptador USB-C",
            quantity: 5,
            unit_price: 5000,
            total_price: 25000,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura_9988.pdf", {
      type: "application/pdf",
    });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId("invoice-code-field")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("FAC-9988")).toBeInTheDocument();

    // Red dot row is sorted at index 0 (Adaptador USB-C)
    expect(screen.getByTestId("error-dot-0")).toBeInTheDocument();
    expect(screen.getByTestId("valid-dot-1")).toBeInTheDocument();

    // The save button MUST be disabled because of errors
    const saveBtn = screen.getByTestId("submit-invoice-products");
    expect(saveBtn).toBeDisabled();
    expect(
      screen.getByText(/No se puede guardar hasta que todas las filas tengan indicador verde/i)
    ).toBeInTheDocument();
  });

  it("allows editing an invalid row to fix the error, enabling the save button", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: null,
      code: "FAC-100",
      total_amount: 25000,
      data: {
        issue_date: "2026-03-20",
        items: [
          {
            code: "",
            name: "Adaptador USB-C",
            quantity: 5,
            unit_price: 5000,
            total_price: 25000,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("error-dot-0")).toBeInTheDocument();
    });

    // Open edit dialog for row 0
    await user.click(screen.getByTestId("edit-row-0"));

    expect(screen.getByTestId("edit-field-code")).toBeInTheDocument();

    // Fill code
    const codeInput = screen.getByTestId("edit-field-code").querySelector("input")!;
    await user.type(codeInput, "SKU-USB-C");

    // Save dialog
    await user.click(screen.getByTestId("save-row-edit"));

    // Now it should have a valid green dot and the save button is enabled
    await waitFor(() => {
      expect(screen.getByTestId("valid-dot-0")).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId("submit-invoice-products");
    expect(saveBtn).not.toBeDisabled();
  });

  it("guarantees atomic persistence: aborts product sync if invoice creation fails", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: null,
      code: "FAC-ERROR-TEST",
      total_amount: 30000,
      data: {
        items: [
          {
            code: "SKU-HDMI",
            name: "Cable HDMI",
            quantity: 10,
            unit_price: 3000,
            total_price: 30000,
          },
        ],
      },
    });

    // Invoice creation fails!
    vi.mocked(businessServices.createInvoiceWithFile).mockRejectedValueOnce(
      new Error("Storage upload failure")
    );

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["pdf content"], "invoice.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("valid-dot-0")).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId("submit-invoice-products");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(businessServices.createInvoiceWithFile).toHaveBeenCalledTimes(1);
    });

    // Products MUST NOT be called!
    expect(businessServices.bulkCreateProducts).not.toHaveBeenCalled();
    expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it("completes atomic persistence: creates invoice first, then saves products", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: null,
      code: "FAC-SUCCESS",
      total_amount: 30000,
      data: {
        items: [
          {
            code: "SKU-HDMI",
            name: "Cable HDMI",
            quantity: 10,
            unit_price: 3000,
            total_price: 30000,
          },
        ],
      },
    });

    vi.mocked(businessServices.createInvoiceWithFile).mockResolvedValueOnce({
      id: "inv-created-1",
      business_id: "biz-123",
      code: "FAC-SUCCESS",
      total_amount: 30000,
      path_storage: "invoices/biz-123/invoice.pdf",
      is_active: true,
      created_at: new Date().toISOString(),
    });

    vi.mocked(businessServices.bulkCreateProducts).mockResolvedValueOnce([
      {
        id: "prod-new-1",
        business_id: "biz-123",
        code: "SKU-HDMI",
        name: "Cable HDMI",
        cost_price: 3000,
        cost_price_tax: 570,
        profit_percentage: 30,
        sale_price: 3900,
        stock: 10,
        is_active: true,
      },
    ]);

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["pdf content"], "invoice.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("valid-dot-0")).toBeInTheDocument();
    });

    const saveBtn = screen.getByTestId("submit-invoice-products");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(businessServices.createInvoiceWithFile).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(businessServices.bulkCreateProducts).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSuccess).toHaveBeenCalledTimes(1);
  });

  it("renders image preview inside dropzone for images, PDF icon for PDFs, and overwrites when a new file is uploaded", async () => {
    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    // 1. Upload image
    const imgFile = new File(["fake image content"], "factura-foto.png", {
      type: "image/png",
    });
    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;
    await user.upload(fileInput, imgFile);

    // Image preview is rendered
    const previewImg = screen.getByRole("img", { name: "factura-foto.png" });
    expect(previewImg).toBeInTheDocument();
    expect(screen.getByText(/Factura cargada: factura-foto.png/i)).toBeInTheDocument();

    // 2. Upload PDF to overwrite
    const pdfFile = new File(["fake pdf content"], "factura-doc.pdf", {
      type: "application/pdf",
    });
    await user.upload(fileInput, pdfFile);

    // Image preview is gone and replaced by PDF file
    expect(screen.queryByRole("img", { name: "factura-foto.png" })).not.toBeInTheDocument();
    expect(screen.getByText(/Factura cargada: factura-doc.pdf/i)).toBeInTheDocument();
  });

  it("applies the individual product creation design and bidirectional automatic recalculation in the extracted item edit modal", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-AUTOCALC-1",
      total_amount: 10000,
      data: {
        items: [
          {
            code: "SKU-AUTO",
            name: "Producto Auto Calc",
            quantity: 2,
            unit_price: 1000,
            total_price: 2000,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("edit-row-0")).toBeInTheDocument();
    });

    // Open edit modal
    await user.click(screen.getByTestId("edit-row-0"));

    // Modal title & Core active switch
    expect(screen.getByRole("heading", { name: /Editar Producto Extraído/i })).toBeInTheDocument();
    expect(screen.getByTestId("edit-field-active-switch")).toBeInTheDocument();

    const costInput = screen.getByTestId("edit-field-cost").querySelector("input")!;
    const taxRateInput = screen.getByTestId("edit-field-tax-rate").querySelector("input")!;
    const costTaxInput = screen.getByTestId("edit-field-cost-tax").querySelector("input")!;
    const marginInput = screen.getByTestId("edit-field-margin").querySelector("input")!;
    const saleInput = screen.getByTestId("edit-field-sale").querySelector("input")!;

    // Initial values
    expect(costInput).toHaveValue(1000);
    expect(taxRateInput).toHaveValue(19);
    expect(costTaxInput).toHaveValue(1190);
    expect(marginInput).toHaveValue(30);
    expect(saleInput).toHaveValue(1547);

    // 1. Changing cost recalculates cost with tax and sale price
    await user.clear(costInput);
    await user.type(costInput, "2000");
    expect(costTaxInput).toHaveValue(2380);
    expect(saleInput).toHaveValue(3094);

    // 2. Changing tax rate recalculates cost with tax and sale price
    await user.clear(taxRateInput);
    await user.type(taxRateInput, "10");
    expect(costTaxInput).toHaveValue(2200);
    expect(saleInput).toHaveValue(2860);

    // 3. Changing cost with tax recalculates cost base and sale price
    await user.clear(costTaxInput);
    await user.type(costTaxInput, "3300");
    expect(costInput).toHaveValue(3000);
    expect(saleInput).toHaveValue(4290);

    // 4. Changing sale price recalculates margin percentage
    await user.clear(saleInput);
    await user.type(saleInput, "4950");
    expect(marginInput).toHaveValue(50); // (4950 - 3300) / 3300 * 100 = 50%

    // 5. Save changes
    await user.click(screen.getByTestId("save-row-edit"));

    // Modal is closed
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /Editar Producto Extraído/i })).not.toBeInTheDocument();
    });

    // Row reflects updated data in table
    expect(screen.getByText(/\$3[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/\$4[.,]950/)).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  }, 15_000);

  it("toggles row lock checkbox, disables action buttons, displays ready badge, and allows saving without requiring all rows to be locked", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-LOCK-TEST",
      total_amount: 5000,
      data: {
        items: [
          {
            code: "SKU-LOCK-1",
            name: "Producto Bloqueable",
            quantity: 3,
            unit_price: 1000,
            total_price: 3000,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("lock-checkbox-0")).toBeInTheDocument();
    });

    const lockCheckbox = screen.getByTestId("lock-checkbox-0").querySelector("input")!;
    const editBtn = screen.getByTestId("edit-row-0");
    const deleteBtn = screen.getByTestId("delete-row-0");
    const saveBtn = screen.getByTestId("submit-invoice-products");

    // Initially unlocked
    expect(lockCheckbox).not.toBeChecked();
    expect(editBtn).not.toBeDisabled();
    expect(deleteBtn).not.toBeDisabled();
    expect(screen.queryByTestId("ready-badge-0")).not.toBeInTheDocument();
    // Non-blocking: save is enabled even when unlocked!
    expect(saveBtn).not.toBeDisabled();

    // 1. Lock the row
    await user.click(lockCheckbox);
    expect(lockCheckbox).toBeChecked();
    expect(editBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    expect(screen.getByTestId("ready-badge-0")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();

    // Save button is still enabled
    expect(saveBtn).not.toBeDisabled();

    // 2. Unlock the row
    await user.click(lockCheckbox);
    expect(lockCheckbox).not.toBeChecked();
    expect(editBtn).not.toBeDisabled();
    expect(deleteBtn).not.toBeDisabled();
    expect(screen.queryByTestId("ready-badge-0")).not.toBeInTheDocument();
  });

  it("synchronizes profit margin with historical product, displays red up arrow for price increase, and renders historical comparison sub-row without action buttons", async () => {
    vi.mocked(businessServices.getProductLogs).mockResolvedValueOnce({
      data: [
        {
          id: "log-sku-hist",
          product_id: "prod-existing-1",
          code: "SKU-EXISTING",
          name: "Producto Existente Historial",
          cost_price: 5000,
          cost_price_tax: 5950,
          profit_percentage: 40,
          sale_price: 8330,
          stock: 10,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: { total_items: 1, page: 1, limit: 10, total_pages: 1 },
    });

    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-HIST-1",
      total_amount: 10000,
      data: {
        items: [
          {
            code: "SKU-EXISTING",
            name: "Producto Existente Factura",
            quantity: 4,
            unit_price: 8000,
            total_price: 32000,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("invoice-row-0")).toBeInTheDocument();
    });

    // Margin is synchronized to 40% in both main row and historical sub-row
    expect(screen.getAllByText("40%")).toHaveLength(2);

    // Price diff indicator is rendered with red up arrow and +60%
    const priceDiffBadge = screen.getByTestId("price-diff-0");
    expect(priceDiffBadge).toBeInTheDocument();
    expect(priceDiffBadge).toHaveTextContent("+60%");

    // Historical comparison sub-row is rendered directly below
    const historicalRow = screen.getByTestId("historical-row-0");
    expect(historicalRow).toBeInTheDocument();
    expect(historicalRow).toHaveTextContent("Histórico");
    expect(historicalRow).toHaveTextContent("SKU-EXISTING");
    expect(historicalRow).toHaveTextContent("Producto Existente Historial");
    expect(historicalRow).toHaveTextContent(/\$8[.,]330/);

    // Historical row does not have action buttons (no edit/delete)
    expect(historicalRow.querySelector('[data-testid^="edit-row"]')).toBeNull();
    expect(historicalRow.querySelector('[data-testid^="delete-row"]')).toBeNull();
  });

  it("displays down arrow when sale price decreases compared to historical product", async () => {
    vi.mocked(businessServices.getProductLogs).mockResolvedValueOnce({
      data: [
        {
          id: "log-sku-decrease",
          product_id: "prod-existing-1",
          code: "SKU-EXISTING",
          name: "Producto Existente Historial",
          cost_price: 10000,
          cost_price_tax: 11900,
          profit_percentage: 20,
          sale_price: 14280,
          stock: 10,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: { total_items: 1, page: 1, limit: 10, total_pages: 1 },
    });

    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-DECR-1",
      total_amount: 10000,
      data: {
        items: [
          {
            code: "SKU-EXISTING",
            name: "Producto Existente Factura",
            quantity: 2,
            unit_price: 6000,
            total_price: 12000,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("invoice-row-0")).toBeInTheDocument();
    });

    const priceDiffBadge = screen.getByTestId("price-diff-0");
    expect(priceDiffBadge).toBeInTheDocument();
    expect(priceDiffBadge).toHaveTextContent("-40%");
  });

  it("smoothly scrolls down and focuses on the results section after successful invoice analysis", async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-SCROLL-TEST",
      total_amount: 5000,
      data: {
        items: [
          {
            code: "SKU-SCROLL-1",
            name: "Producto Con Scroll",
            quantity: 1,
            unit_price: 2500,
            total_price: 2500,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("invoice-results-section")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  it("displays an error alert and allows retrying when invoice analysis fails", async () => {
    const error503 = {
      name: "AxiosError",
      message: "Request failed with status code 503",
      response: {
        status: 503,
        data: {
          message:
            "El servicio de inteligencia artificial está experimentando alta demanda temporalmente. Por favor, reintente en unos instantes.",
        },
      },
    };

    vi.mocked(businessServices.analyzeInvoice).mockRejectedValueOnce(error503);

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy pdf"], "factura.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));

    // Alert with error message and retry button appears
    await waitFor(() => {
      expect(screen.getByTestId("retry-analyze-btn")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        /El servicio de inteligencia artificial está experimentando alta demanda temporalmente/i
      )
    ).toBeInTheDocument();

    // Now mock success for the retry
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-RETRY-OK",
      total_amount: 10000,
      data: {
        items: [
          {
            code: "SKU-RETRY-1",
            name: "Producto Reintentado",
            quantity: 2,
            unit_price: 5000,
            total_price: 10000,
          },
        ],
      },
    });

    // Click retry button
    await user.click(screen.getByTestId("retry-analyze-btn"));

    // Successfully renders the results section and provisional table
    await waitFor(() => {
      expect(screen.getByTestId("invoice-results-section")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("FAC-RETRY-OK")).toBeInTheDocument();
    expect(screen.getByText("Producto Reintentado")).toBeInTheDocument();
  });

  it("analyzes invoice with Mistral OCR when clicking the Mistral button, sending ai_provider='mistral'", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-MISTRAL-001",
      total_amount: 32000,
      data: {
        issue_date: "2026-03-16",
        items: [
          {
            code: "SKU-MIST-1",
            name: "Harina Pan Mistral",
            quantity: 4,
            cost_price: 6000,
            cost_price_tax: 7140,
            unit_price: 7140,
            total_price: 28560,
          },
        ],
      },
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["%PDF-1.4 mock content"], "factura_mistral.pdf", {
      type: "application/pdf",
    });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    const mistralBtn = screen.getByTestId("analyze-invoice-mistral-btn");
    expect(mistralBtn).toBeInTheDocument();
    expect(mistralBtn).not.toBeDisabled();

    await user.click(mistralBtn);

    await waitFor(() => {
      expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: "biz-123",
          provider_id: "prov-1",
          ai_provider: "mistral",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("invoice-results-section")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("FAC-MISTRAL-001")).toBeInTheDocument();
  });

  it("disables the Mistral button when can_use_mistral is false in authorization context", async () => {
    useGeneralSettingsStore.setState({
      isLoaded: true,
      can_use_gemini: true,
      can_use_mistral: false,
      can_analyze_invoice: true,
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    const geminiBtn = screen.getByTestId("analyze-invoice-btn");
    const mistralBtn = screen.getByTestId("analyze-invoice-mistral-btn");

    expect(geminiBtn).not.toBeDisabled();
    expect(mistralBtn).toBeDisabled();
  });

  it("disables the Gemini button when can_use_gemini is false in authorization context", async () => {
    useGeneralSettingsStore.setState({
      isLoaded: true,
      can_use_gemini: false,
      can_use_mistral: true,
      can_analyze_invoice: true,
    });

    renderWithClient(
      <ProductInvoiceImport
        businessId="biz-123"
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await selectProvider();

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    const geminiBtn = screen.getByTestId("analyze-invoice-btn");
    const mistralBtn = screen.getByTestId("analyze-invoice-mistral-btn");

    expect(geminiBtn).toBeDisabled();
    expect(mistralBtn).not.toBeDisabled();
  });
});

