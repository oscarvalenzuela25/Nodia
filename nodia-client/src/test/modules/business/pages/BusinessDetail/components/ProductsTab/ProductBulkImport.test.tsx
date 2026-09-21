import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  ProductBulkImport,
  validateRow,
  parseCSV,
  generateTemplateCSV,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductBulkImport";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../../../../modules/business/infrastructure/services", () => ({
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

describe("ProductBulkImport Helpers", () => {
  describe("validateRow", () => {
    it("returns errors when required fields are missing or invalid", () => {
      const result = validateRow({
        code: "",
        name: "",
        cost_price: -10,
        cost_price_tax: -5,
        profit_percentage: -1,
        sale_price: -100,
        stock: -50,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("Código es requerido");
      expect(result.errors).toContain("Nombre es requerido");
      expect(result.errors).toContain("Costo debe ser >= 0");
    });

    it("returns valid when all required numeric and string fields are correct", () => {
      const result = validateRow({
        code: "SKU-VALID",
        name: "Producto Válido",
        cost_price: 1000,
        cost_price_tax: 190,
        profit_percentage: 30,
        sale_price: 1500,
        stock: 100,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("parseCSV & Error Row Sorting", () => {
    it("parses CSV correctly and places error rows strictly at the top", () => {
      // Row 1: Valid
      // Row 2: Invalid (missing code and negative cost)
      // Row 3: Valid
      const csvData = [
        "code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active",
        "SKU-001,Galleta Vainilla,500,95,30,800,20,true",
        ",Producto Sin Codigo,-100,0,10,200,10,true",
        "SKU-003,Bebida Energética,1200,228,25,1800,50,true",
      ].join("\n");

      const rows = parseCSV(csvData);

      expect(rows).toHaveLength(3);
      // The invalid row MUST be sorted to index 0!
      expect(rows[0].isValid).toBe(false);
      expect(rows[0].name).toBe("Producto Sin Codigo");
      expect(rows[0].errors).toContain("Código es requerido");

      // Valid rows follow
      expect(rows[1].isValid).toBe(true);
      expect(rows[2].isValid).toBe(true);
    });

    it("parses CSV with localized Spanish headers containing DB field in parentheses", () => {
      const csvData = [
        "Código (code),Nombre (name),Costo base (cost_price),Impuesto (cost_price_tax),Margen % (profit_percentage),Precio de venta (sale_price),Stock (stock),Activo (is_active)",
        "ES-001,Alfajor Artesanal,800,152,30,1300,40,true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("ES-001");
      expect(rows[0].name).toBe("Alfajor Artesanal");
      expect(rows[0].cost_price).toBe(800);
      expect(rows[0].cost_price_tax).toBe(152);
      expect(rows[0].profit_percentage).toBe(30);
      expect(rows[0].sale_price).toBe(1300);
      expect(rows[0].stock).toBe(40);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with localized English headers containing DB field in parentheses", () => {
      const csvData = [
        "Code (code),Name (name),Base cost (cost_price),Tax (cost_price_tax),Margin % (profit_percentage),Sale price (sale_price),Stock (stock),Active (is_active)",
        "EN-001,Organic Green Tea,1500,285,25,2300,60,true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("EN-001");
      expect(rows[0].name).toBe("Organic Green Tea");
      expect(rows[0].cost_price).toBe(1500);
      expect(rows[0].cost_price_tax).toBe(285);
      expect(rows[0].profit_percentage).toBe(25);
      expect(rows[0].sale_price).toBe(2300);
      expect(rows[0].stock).toBe(60);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with positional fallback when headers are custom or unnamed", () => {
      const csvData = [
        "Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8",
        "POS-001,Positional Item,2000,380,20,2900,15,true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("POS-001");
      expect(rows[0].name).toBe("Positional Item");
      expect(rows[0].cost_price).toBe(2000);
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with semicolon delimiter", () => {
      const csvData = [
        "code;name;cost_price;cost_price_tax;profit_percentage;sale_price;stock;is_active",
        "SKU-SEMI;Chocolate Dulce;700;133;30;1100;15;true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("SKU-SEMI");
      expect(rows[0].name).toBe("Chocolate Dulce");
      expect(rows[0].cost_price).toBe(700);
      expect(rows[0].isValid).toBe(true);
    });

    it("returns empty array for empty or single line CSV", () => {
      expect(parseCSV("")).toEqual([]);
      expect(parseCSV("header,only")).toEqual([]);
    });
  });

  describe("generateTemplateCSV", () => {
    it("returns a valid CSV template string with headers in Spanish by default", () => {
      const template = generateTemplateCSV("es");
      expect(template).toContain("Código (code)");
      expect(template).toContain("Nombre (name)");
      expect(template).toContain("Costo base (cost_price)");
      expect(template).toContain("PROD-001");
    });

    it("returns a valid CSV template string with headers in English when specified", () => {
      const template = generateTemplateCSV("en");
      expect(template).toContain("Code (code)");
      expect(template).toContain("Name (name)");
      expect(template).toContain("Base cost (cost_price)");
      expect(template).toContain("PROD-001");
    });
  });
});

describe("ProductBulkImport Component", () => {
  const defaultProps = {
    businessId: "biz-123",
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders upload dropzone, download template button, and action buttons", () => {
    renderWithClient(<ProductBulkImport {...defaultProps} />);

    expect(screen.getByText(/Descargar Plantilla CSV/i)).toBeInTheDocument();
    expect(screen.getByText(/Haz clic o arrastra tu archivo CSV aquí/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Volver al catálogo/i })).toBeInTheDocument();
  });

  it("calls onCancel when clicking Volver al catálogo button", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductBulkImport {...defaultProps} />);

    const backBtn = screen.getByRole("button", { name: /Volver al catálogo/i });
    await user.click(backBtn);

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("handles CSV file upload, displays provisional table, and blocks submit on errors", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductBulkImport {...defaultProps} />);

    const csvContent = [
      "code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active",
      "SKU-OK,Café Grano 1kg,5000,950,40,8500,25,true",
      ",Té Verde Sin SKU,2000,380,30,3200,40,true",
    ].join("\n");

    const file = new File([csvContent], "productos.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    // Provisional table appears with error row sorted to the top
    await waitFor(() => {
      expect(screen.getByText("Té Verde Sin SKU")).toBeInTheDocument();
    });

    expect(screen.getByTestId("row-status-error")).toBeInTheDocument();
    expect(screen.getByText(/indicador verde/i)).toBeInTheDocument();

    // Confirm button is disabled because errors exist
    const submitBtn = screen.getByTestId("submit-bulk-products");
    expect(submitBtn).toBeDisabled();
  });

  it("allows editing an error row to fix it, which enables the submit button", async () => {
    const user = userEvent.setup();
    vi.mocked(businessServices.bulkCreateProducts).mockResolvedValue([
      {
        id: "new-prod-1",
        business_id: "biz-123",
        code: "SKU-MANZANILLA",
        name: "Té Manzanilla",
        cost_price: 1000,
        cost_price_tax: 190,
        profit_percentage: 30,
        sale_price: 1600,
        stock: 10,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderWithClient(<ProductBulkImport {...defaultProps} />);

    // CSV with only 1 row that is missing code
    const csvContent = [
      "code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active",
      ",Té Manzanilla,1000,190,30,1600,10,true",
    ].join("\n");

    const file = new File([csvContent], "productos.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId("row-status-error")).toBeInTheDocument();
    });

    // Submit is disabled
    const submitBtn = screen.getByTestId("submit-bulk-products");
    expect(submitBtn).toBeDisabled();

    // Click edit row button (first button in Actions column)
    const editRowBtn = screen.getByTestId("edit-row-0");
    await user.click(editRowBtn);

    // Modal opens
    expect(screen.getByRole("heading", { name: /Editar Producto Provisorio/i })).toBeInTheDocument();

    // Fill in missing code using textbox role
    const codeInput = screen.getByRole("textbox", { name: /Código/i });
    await user.type(codeInput, "SKU-MANZANILLA");

    // Save edit
    const saveRowBtn = screen.getByRole("button", { name: "Guardar Cambios" });
    await user.click(saveRowBtn);

    // Row is now valid (green badge)!
    await waitFor(() => {
      expect(screen.getByTestId("row-status-valid")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("row-status-error")).not.toBeInTheDocument();

    // Submit button is now ENABLED!
    expect(submitBtn).not.toBeDisabled();

    // Click submit
    await user.click(submitBtn);

    await waitFor(() => {
      expect(businessServices.bulkCreateProducts).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("allows deleting a row from the provisional table", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductBulkImport {...defaultProps} />);

    const csvContent = [
      "code,name,cost_price,cost_price_tax,profit_percentage,sale_price,stock,is_active",
      "SKU-DEL,Producto Para Borrar,1000,190,30,1600,10,true",
    ].join("\n");

    const file = new File([csvContent], "productos.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText("Producto Para Borrar")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTestId("delete-row-0");
    await user.click(deleteBtn);

    // Table is emptied
    expect(screen.queryByText("Producto Para Borrar")).not.toBeInTheDocument();
  });
});
