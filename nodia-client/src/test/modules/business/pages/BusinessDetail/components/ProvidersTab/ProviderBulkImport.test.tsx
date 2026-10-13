import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  ProviderBulkImport,
  validateRow,
  parseCSV,
  generateTemplateCSV,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderBulkImport";
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
  importProviders: vi.fn(),
  bulkCreateProviders: vi.fn(),
  bulkUpdateProviders: vi.fn(),
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

describe("ProviderBulkImport Helpers", () => {
  describe("validateRow", () => {
    it("returns errors when required fields are missing or invalid", () => {
      const result = validateRow({
        name: "",
        tax: 150,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("business:provider_csv_name_required");
      expect(result.errors).toContain("business:provider_csv_tax_error");
    });

    it("returns error when name is shorter than 2 characters", () => {
      const result = validateRow({
        name: "A",
        tax: 19,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("business:provider_csv_name_error");
    });

    it("returns valid when all fields are correct", () => {
      const result = validateRow({
        name: "Distribuidora Los Andes",
        tax: 19,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("parseCSV & Error Row Sorting", () => {
    it("parses CSV correctly and places error rows strictly at the top", () => {
      // Row 1: Valid
      // Row 2: Invalid (name missing)
      // Row 3: Valid
      const csvData = [
        "name,tax,is_active,field_code,instructions_code",
        "Distribuidora Central,19,true,COD_ART,instruccion",
        ",19,true,COD_ART,instruccion",
        "Comercial Norte,19,true,SKU,",
      ].join("\n");

      const rows = parseCSV(csvData);

      expect(rows).toHaveLength(3);
      // The invalid row MUST be sorted to index 0!
      expect(rows[0].isValid).toBe(false);
      expect(rows[0].name).toBe("");
      expect(rows[0].errors).toContain("business:provider_csv_name_required");

      // Valid rows follow
      expect(rows[1].isValid).toBe(true);
      expect(rows[1].name).toBe("Distribuidora Central");
      expect(rows[2].isValid).toBe(true);
      expect(rows[2].name).toBe("Comercial Norte");
    });

    it("parses CSV with localized Spanish headers containing DB field in parentheses", () => {
      const csvData = [
        "Nombre (name),Impuesto % (tax),Activo (is_active),Columna Código (field_code),Instrucciones Código (instructions_code),Columna Costo Neto (field_cost_price),Instrucciones Costo Neto (instructions_cost_price),Columna Costo IVA (field_cost_price_tax),Instrucciones Costo IVA (instructions_cost_price_tax),Columna Bultos (field_packages),Instrucciones Bultos (instructions_packages),Columna Unidades por Bulto (field_units_per_package),Instrucciones Unidades por Bulto (instructions_units_per_package),ID (id)",
        "Embonor S.A.,19,true,CODIGO,,PRECIO_NETO,,PRECIO_BRUTO,,BULTOS,,FACTOR,,9007199254740993",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe("9007199254740993");
      expect(rows[0].name).toBe("Embonor S.A.");
      expect(rows[0].tax).toBe(19);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].code.value).toBe("CODIGO");
      expect(rows[0].cost_price.value).toBe("PRECIO_NETO");
      expect(rows[0].cost_price_tax.value).toBe("PRECIO_BRUTO");
      expect(rows[0].packages.value).toBe("BULTOS");
      expect(rows[0].units_per_package.value).toBe("FACTOR");
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with localized English headers containing DB field in parentheses", () => {
      const csvData = [
        "Name (name),Tax % (tax),Active (is_active),Code Column (field_code),Code Instructions (instructions_code),Net Cost Column (field_cost_price),Net Cost Instructions (instructions_cost_price),Tax Cost Column (field_cost_price_tax),Tax Cost Instructions (instructions_cost_price_tax),Packages Column (field_packages),Packages Instructions (instructions_packages),Units Per Package Column (field_units_per_package),Units Per Package Instructions (instructions_units_per_package),ID (id)",
        "Global Foods Inc,15,true,ITEM_CODE,Look at line 1,UNIT_COST,,GROSS_COST,,BOX_QTY,,PCS_BOX,",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Global Foods Inc");
      expect(rows[0].tax).toBe(15);
      expect(rows[0].is_active).toBe(true);
      expect(rows[0].code.value).toBe("ITEM_CODE");
      expect(rows[0].code.instructions).toBe("Look at line 1");
      expect(rows[0].cost_price.value).toBe("UNIT_COST");
      expect(rows[0].cost_price_tax.value).toBe("GROSS_COST");
      expect(rows[0].packages.value).toBe("BOX_QTY");
      expect(rows[0].units_per_package.value).toBe("PCS_BOX");
      expect(rows[0].isValid).toBe(true);
    });

    it("parses CSV with semicolon delimiter", () => {
      const csvData = [
        "name;tax;is_active;field_code;instructions_code",
        "Proveedor Semicolon;19;true;SKU_SEMI;Instrucciones",
      ].join("\n");

      const rows = parseCSV(csvData);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Proveedor Semicolon");
      expect(rows[0].tax).toBe(19);
      expect(rows[0].code.value).toBe("SKU_SEMI");
      expect(rows[0].code.instructions).toBe("Instrucciones");
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
      expect(template).toContain("Nombre (name)");
      expect(template).toContain("Impuesto % (tax)");
      expect(template).toContain("Activo (is_active)");
      expect(template).toContain("Columna Código (field_code)");
      expect(template).toContain("(contacts)");
      expect(template).toContain("(fields_json)");
    });

    it("returns a valid CSV template string with headers in English when specified", () => {
      const template = generateTemplateCSV("en");
      expect(template).toContain("Name (name)");
      expect(template).toContain("Tax % (tax)");
      expect(template).toContain("Active (is_active)");
      expect(template).toContain("Code Column (field_code)");
      expect(template).toContain("(contacts)");
      expect(template).toContain("(fields_json)");
    });
  });
});

describe("ProviderBulkImport Component", () => {
  const defaultProps = {
    businessId: "biz-123",
    onCancel: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders back button, download template button, alert instructions, and dropzone", () => {
    renderWithClient(<ProviderBulkImport {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /volver a proveedores|back to providers/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /descargar plantilla|download template/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/instrucciones de la plantilla|template instructions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/haz clic o arrastra tu archivo csv aquí|click or drag your csv file here/i)
    ).toBeInTheDocument();
  });

  it("handles back button click", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProviderBulkImport {...defaultProps} />);

    const backBtn = screen.getByRole("button", {
      name: /volver a proveedores|back to providers/i,
    });
    await user.click(backBtn);

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it("submits bulk providers when valid rows are uploaded", async () => {
    vi.mocked(businessServices.importProviders).mockResolvedValueOnce({ providers: 1, contacts: 0 });

    const { container } = renderWithClient(<ProviderBulkImport {...defaultProps} />);

    const csvContent = [
      "name,tax,is_active,field_code,field_cost_price",
      "Proveedor Nuevo,19,true,COD_1,PRECIO_1",
    ].join("\n");
    const file = new File([csvContent], "providers.csv", { type: "text/csv" });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText("Proveedor Nuevo")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", {
      name: /crear \/ actualizar proveedores|create \/ update providers/i,
    });
    expect(submitBtn).toBeEnabled();

    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(businessServices.importProviders).toHaveBeenCalledTimes(1);
      expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves mixed provider/contact draft after failure and retries one atomic request', async () => {
    vi.mocked(businessServices.importProviders).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ providers: 2, contacts: 1 });
    const { container } = renderWithClient(<ProviderBulkImport {...defaultProps} />);
    const csv = 'name,tax,is_active,id,contacts\nProveedor Nuevo QA,0,false,,"[{""name"":""María"",""email"":""qa@example.test""}]"\nExistente,19,true,9007199254740993,';
    await userEvent.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File([csv],'retry.csv',{type:'text/csv'}));
    await screen.findByText('Proveedor Nuevo QA');
    const save = screen.getByRole('button',{name:/crear \/ actualizar proveedores/i});
    await userEvent.click(save);
    await waitFor(()=>expect(businessServices.importProviders).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(save).toBeEnabled());
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Proveedor Nuevo QA')).toBeInTheDocument();
    expect(screen.getByText('Existente')).toBeInTheDocument();
    expect(screen.getByText(/qa@example.test/)).toBeInTheDocument();
    const sent = vi.mocked(businessServices.importProviders).mock.calls[0][0];
    expect(sent[0]).toMatchObject({tax:0,is_active:false,contacts:[{name:'María',email:'qa@example.test'}]});
    await userEvent.click(save);
    await waitFor(()=>expect(defaultProps.onSuccess).toHaveBeenCalledOnce());
    expect(vi.mocked(businessServices.importProviders).mock.calls[1][0]).toEqual(sent);
  });
});
