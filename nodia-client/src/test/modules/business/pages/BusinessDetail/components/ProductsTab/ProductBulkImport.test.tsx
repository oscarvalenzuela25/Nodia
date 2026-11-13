import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { sileo } from "sileo";
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
        sale_price: -100,
        stock: -50,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).not.toContain("Código es requerido");
      expect(result.errors).toContain("Nombre es requerido");
      expect(result.errors).toContain("Costo debe ser un importe entero CLP válido");
    });

    it("returns valid when all required numeric and string fields are correct", () => {
      const result = validateRow({
        code: "SKU-VALID",
        name: "Producto Válido",
        cost_price: 1000,
        cost_price_tax: 190,
        sale_price: 1500,
        stock: 100,
        has_stock: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("parseCSV & Error Row Sorting", () => {
    it("parses CSV correctly and places error rows strictly at the top", () => {
      // Row 1: Valid
      // Row 2: Invalid because the cost is negative; its omitted code is allowed.
      // Row 3: Valid
      const csvData = [
        "code,name,cost_price,cost_price_tax,sale_price,stock,is_active,has_stock",
        "SKU-001,Galleta Vainilla,500,95,800,20,true,true",
        ",Producto Sin Codigo,-100,0,200,10,true,true",
        "SKU-003,Bebida Energética,1200,228,1800,50,true,true",
      ].join("\n");

      const rows = parseCSV(csvData);

      expect(rows).toHaveLength(3);
      // The invalid row MUST be sorted to index 0!
      expect(rows[0].isValid).toBe(false);
      expect(rows[0].name).toBe("Producto Sin Codigo");
      expect(rows[0].errors).toContain("Costo debe ser un importe entero CLP válido");

      // Valid rows follow
      expect(rows[1].isValid).toBe(true);
      expect(rows[2].isValid).toBe(true);
    });

    it("parses CSV with localized Spanish headers containing DB field in parentheses", () => {
      const csvData = [
        "Código (code),Nombre (name),Costo base (cost_price),Impuesto (cost_price_tax),Precio de venta (sale_price),Stock (stock),Activo (is_active),Disponible (has_stock)",
        "ES-001,Alfajor Artesanal,800,152,1300,40,true,true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("ES-001");
      expect(rows[0].name).toBe("Alfajor Artesanal");
      expect(rows[0].cost_price).toBe(800);
      expect(rows[0].cost_price_tax).toBe(152);
      expect(rows[0].sale_price).toBe(1300);
      expect(rows[0].stock).toBe(40);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with localized English headers containing DB field in parentheses", () => {
      const csvData = [
        "Code (code),Name (name),Base cost (cost_price),Tax (cost_price_tax),Sale price (sale_price),Stock (stock),Active (is_active),Available (has_stock)",
        "EN-001,Organic Green Tea,1500,285,2300,60,true,true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("EN-001");
      expect(rows[0].name).toBe("Organic Green Tea");
      expect(rows[0].cost_price).toBe(1500);
      expect(rows[0].cost_price_tax).toBe(285);
      expect(rows[0].sale_price).toBe(2300);
      expect(rows[0].stock).toBe(60);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with positional fallback when headers are custom or unnamed", () => {
      const csvData = [
        "Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8",
        "POS-001,Positional Item,2000,380,20,2900,15,true,true",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].code).toBe("POS-001");
      expect(rows[0].name).toBe("Positional Item");
      expect(rows[0].cost_price).toBe(2000);
      expect(rows[0].isValid).toBe(false);
    });

    it("parses CSV with semicolon delimiter", () => {
      const csvData = [
        "code;name;cost_price;cost_price_tax;sale_price;stock;is_active;has_stock",
        "SKU-SEMI;Chocolate Dulce;700;133;1100;15;true;true",
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

  it("waits for the CSV read and an explicit submit before creating products", async () => {
    const user = userEvent.setup();
    const csv = "name,cost_price,cost_price_tax,sale_price,has_stock\nSynthetic delayed product,100,119,150,true";
    const file = new File([csv], "products.csv", { type: "text/csv" });
    const pendingReaders: FileReader[] = [];
    const read = vi.spyOn(FileReader.prototype, "readAsText").mockImplementation(function (this: FileReader) {
      pendingReaders.push(this);
    });
    const create = vi.mocked(businessServices.bulkCreateProducts).mockReset().mockResolvedValueOnce([{
      id: "104", version: 1, business_id: "biz-123", code: null, measurement_unit: "unit", name: "Synthetic delayed product",
      cost_price: 100, cost_price_tax: 119, sale_price: 150, stock: 0, is_active: true,
    }]);
    try {
      renderWithClient(<ProductBulkImport {...defaultProps} />);
      await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);
      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith(file);
      expect(screen.queryByTestId("submit-bulk-products")).not.toBeInTheDocument();
      expect(screen.queryByText("Synthetic delayed product")).not.toBeInTheDocument();
      expect(create).not.toHaveBeenCalled();
      expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
      expect(defaultProps.onCancel).not.toHaveBeenCalled();

      // Upload only selects the file. The reader and its React render settle later.
      const reader = pendingReaders[0];
      if (!reader) throw new Error("Synthetic CSV reader was not started");
      act(() => {
        Object.defineProperty(reader, "result", { value: csv, configurable: true });
        reader.dispatchEvent(new ProgressEvent("load"));
      });
      const submit = await screen.findByTestId("submit-bulk-products");
      await waitFor(() => expect(submit).toBeEnabled());
      expect(screen.getByText("Synthetic delayed product")).toBeInTheDocument();
      expect(create).not.toHaveBeenCalled();
      expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();

      await user.click(submit);
      await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith([expect.objectContaining({
        business_id: "biz-123", code: null, name: "Synthetic delayed product",
        cost_price: 100, cost_price_tax: 119, sale_price: 150,
      })]);
      expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });

  it("calls onCancel when clicking Volver al catálogo button", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductBulkImport {...defaultProps} />);

    const backBtn = screen.getByRole("button", { name: /Volver al catálogo/i });
    await user.click(backBtn);

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps CSV sale prices manual and sends only an explicitly applied suggestion", async () => {
    const user = userEvent.setup();
    vi.mocked(businessServices.bulkCreateProducts).mockResolvedValueOnce([{ id: "101", version: 1, business_id: "biz-123", code: null, name: "Synthetic", cost_price: 2000, cost_price_tax: 2000, sale_price: 3570, has_stock: true, stock: 0, is_active: true }]);
    renderWithClient(<ProductBulkImport {...defaultProps} />);
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement,
      new File(["name,cost_price,cost_price_tax,sale_price,has_stock\nSynthetic,1000,1190,999,true"], "synthetic.csv", { type: "text/csv" }));
    await user.click(await screen.findByTestId("edit-row-0"));
    const sale = screen.getByRole("spinbutton", { name: /^Precio Venta/ });
    const net = screen.getByRole("spinbutton", { name: /^Costo Base sin Impuesto/ });
    const gross = screen.getByRole("spinbutton", { name: "Costo Base con Impuestos" });
    fireEvent.change(sale, { target: { value: "1200" } });
    expect(net).toHaveValue(1000);
    expect(gross).toHaveValue(1190);
    fireEvent.change(gross, { target: { value: "2380" } });
    expect(net).toHaveValue(2000);
    expect(sale).toHaveValue(1200);
    fireEvent.change(screen.getByTestId("product-suggested-markup-input").querySelector("input")!, { target: { value: "50" } });
    expect(sale).toHaveValue(1200);
    fireEvent.click(screen.getByRole("button", { name: "Usar precio sugerido" }));
    expect(sale).toHaveValue(3570);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Impuesto %" }), { target: { value: "0" } });
    expect(gross).toHaveValue(2000);
    expect(sale).toHaveValue(3570);
    fireEvent.change(gross, { target: { value: "" } });
    expect(gross).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Guardar Cambios" })).toBeDisabled();
    expect(sale).toHaveValue(3570);
    fireEvent.change(gross, { target: { value: "2000" } });
    await user.click(screen.getByRole("button", { name: "Guardar Cambios" }));
    await user.click(screen.getByTestId("submit-bulk-products"));
    await waitFor(() => expect(businessServices.bulkCreateProducts).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(businessServices.bulkCreateProducts).mock.calls[0][0][0];
    expect(payload).toMatchObject({ sale_price: 3570, cost_price: 2000, cost_price_tax: 2000 });
    expect(payload).not.toHaveProperty("markup");
    expect(payload).not.toHaveProperty("suggested_markup");
  });

  it("handles CSV file upload, displays provisional table, and blocks submit on errors", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductBulkImport {...defaultProps} />);

    const csvContent = [
      "code,name,cost_price,cost_price_tax,sale_price,stock,is_active,has_stock",
      "SKU-OK,Café Grano 1kg,5000,950,8500,25,true,true",
      ",Té Verde Sin SKU,-2000,380,3200,40,true,true",
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
        version: 1,
        measurement_unit: "unit",
        business_id: "biz-123",
        code: "SKU-MANZANILLA",
        name: "Té Manzanilla",
        cost_price: 1000,
        cost_price_tax: 190,
        sale_price: 1600,
        stock: 10,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    renderWithClient(<ProductBulkImport {...defaultProps} />);

    // The row is invalid because its name is missing; supplier codes are optional.
    const csvContent = [
      "code,name,cost_price,cost_price_tax,sale_price,stock,is_active,has_stock",
      "SKU-MANZANILLA,,1000,190,1600,10,true,true",
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

    // Fill in the missing name without changing supplier/barcode identity.
    const nameInput = screen.getByRole("textbox", { name: /Nombre del Producto/i });
    await user.type(nameInput, "Té Manzanilla");

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
      "code,name,cost_price,cost_price_tax,sale_price,stock,is_active,has_stock",
      "SKU-DEL,Producto Para Borrar,1000,190,1600,10,true,true",
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
  it("retains distinct created IDs for two products without codes when a later update fails", async () => {
    const user = userEvent.setup();
    const created = [
      { id: "101", business_id: "biz-123", code: null, measurement_unit: "kg", name: "Tomates", version: 1, cost_price: 100, cost_price_tax: 119, sale_price: 150, stock: 0, is_active: true },
      { id: "102", business_id: "biz-123", code: null, measurement_unit: "bundle", name: "Hierbas", version: 1, cost_price: 100, cost_price_tax: 119, sale_price: 150, stock: 0, is_active: true },
    ] as const;
    vi.mocked(businessServices.bulkCreateProducts).mockResolvedValue([...created]);
    vi.mocked(businessServices.bulkUpdateProducts).mockRejectedValueOnce(new Error("Synthetic update failure")).mockResolvedValueOnce([]);
    renderWithClient(<ProductBulkImport {...defaultProps} />);
    const csv = 'id,code,name,cost_price,cost_price_tax,sale_price,has_stock,measurement_unit,version\n,,Tomates,100,119,150,true,kg,\n,,Hierbas,100,119,150,true,bundle,\n16,EXIST,Actual,100,119,150,true,unit,3';
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File([csv], "products.csv", { type: "text/csv" }));
    const submit = await screen.findByTestId("submit-bulk-products");
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(businessServices.bulkUpdateProducts).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit).toBeEnabled());
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    await user.click(submit);
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1));
    expect(businessServices.bulkCreateProducts).toHaveBeenCalledTimes(1);
    expect(businessServices.bulkUpdateProducts).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "101", code: null, measurement_unit: "kg", expected_version: 1 }),
      expect.objectContaining({ id: "102", code: null, measurement_unit: "bundle", expected_version: 1 }),
      expect.objectContaining({ id: "16", code: "EXIST", expected_version: 3 }),
    ]);
  });

  it("allows correcting and retrying a known 400 rejection for a product without a supplier code", async () => {
    const user = userEvent.setup();
    vi.mocked(businessServices.bulkCreateProducts).mockReset().mockRejectedValueOnce(
      Object.assign(new AxiosError("Synthetic validation rejection"), { response: { status: 400, data: { message: "Synthetic validation" } } })
    ).mockResolvedValueOnce([{
      id: "103", version: 1, business_id: "biz-123", code: null, measurement_unit: "unit", name: "Producto corregido",
      cost_price: 100, cost_price_tax: 119, sale_price: 150, stock: 0, is_active: true,
    }]);
    renderWithClient(<ProductBulkImport {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["name,cost_price,cost_price_tax,sale_price,has_stock\nProducto sin código,100,119,150,true"], "products.csv", { type: "text/csv" }));
    const submit = await screen.findByTestId("submit-bulk-products");
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(businessServices.bulkCreateProducts).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit).toBeEnabled());
    expect(screen.getByText("Producto sin código")).toBeInTheDocument();
    expect(fileInput).toBeEnabled();
    await user.click(screen.getByTestId("edit-row-0"));
    const name = screen.getByRole("textbox", { name: /Nombre del Producto/i });
    await user.clear(name);
    await user.type(name, "Producto corregido");
    await user.click(screen.getByRole("button", { name: "Guardar Cambios" }));
    await user.click(submit);
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1));
    expect(businessServices.bulkCreateProducts).toHaveBeenCalledTimes(2);
    expect(businessServices.bulkCreateProducts).toHaveBeenLastCalledWith([expect.objectContaining({ code: null, name: "Producto corregido", measurement_unit: "unit" })]);
  });

  it.each(["503", "lost-response", "incomplete-receipt"] as const)("preserves code-less rows and blocks another create after an uncertain %s", async (failure) => {
    const user = userEvent.setup();
    const create = vi.mocked(businessServices.bulkCreateProducts).mockReset();
    if (failure === "incomplete-receipt") create.mockResolvedValueOnce([]);
    else create.mockRejectedValueOnce(failure === "503"
      ? Object.assign(new AxiosError("Synthetic service failure"), { response: { status: 503, data: { message: "Synthetic unavailable" } } })
      : new AxiosError("Synthetic lost response"));
    renderWithClient(<ProductBulkImport {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["name,cost_price,cost_price_tax,sale_price,has_stock\nProducto sin código,100,119,150,true"], "products.csv", { type: "text/csv" }));
    const submit = await screen.findByTestId("submit-bulk-products");
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);
    await waitFor(() => expect(screen.getByText(/Revisa el catálogo manualmente/i)).toBeInTheDocument());
    expect(screen.getByText("Producto sin código")).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(fileInput).toBeDisabled();
    expect(screen.getByTestId("edit-row-0")).toBeDisabled();
    expect(screen.getByTestId("delete-row-0")).toBeDisabled();
    fireEvent.click(submit);
    expect(create).toHaveBeenCalledTimes(1);
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(sileo.error).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Volver al catálogo/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

});
