import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  ProductInvoiceImport,
  validateInvoiceRow,
  validateInvoiceRows,
  mapExtractedItemsToRows,
  calculatePriceDiff,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import { reserveObservation } from "../../../../../../../modules/business/components/AnalysisConsole/infrastructure/services";
import { sileo } from "sileo";
vi.mock("../../../../../../../modules/business/components/AnalysisConsole/infrastructure/services", () => ({
  reserveObservation: vi.fn(async () => ({ version: 1, id: crypto.randomUUID() })),
  readObservation: vi.fn(async (id: string) => ({ version: 1, id, state: 'succeeded', identity: null, events: [], lastSequence: 0, gap: false })),
}));
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
      { id: "prov-1", name: "Distribuidora Central", business_id: "biz-123", tax: 19 },
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
  verifyIaProviders: vi.fn().mockResolvedValue([{ id: "ai-primary", key: "gemini", name: "Google Gemini", mode: "agentic", is_active: true, can_use_model: true, is_default: true, use_agentic: true, default_mode: "agentic", fields: { selected_model: "model-current" } }, { id: "ai-secondary", key: "gemini", name: "Gemini Secundario", mode: "agentic", is_active: true, can_use_model: true, use_agentic: true, default_mode: "agentic", fields: { selected_model: "model-secondary" } }]),
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

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const syntheticAnalysis = (code: string, itemCode = "SYNTHETIC-NEW") => ({ business_id: "biz-123", provider_id: "prov-1", code, total_amount: 119,
  data: { items: [{ code: itemCode, name: `Synthetic ${itemCode}`, quantity: 1, cost_price: 100, cost_price_tax: 119 }] } });

describe("ProductInvoiceImport Helpers", () => {
  describe("validateInvoiceRow", () => {
    it("returns errors when required fields are missing or numbers are negative", () => {
      const result = validateInvoiceRow({
        code: "",
        name: "",
        cost_price: -100,
        cost_price_tax: -19,
        sale_price: -200,
        quantity: -1,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Código es requerido");
      expect(result.errors).toContain("Nombre es requerido");
      expect(result.errors).toContain("Costo debe ser un importe entero CLP válido");
    });

    it("returns valid when all fields satisfy business rules", () => {
      const result = validateInvoiceRow({
        code: "SKU-TEST-1",
        name: "Mouse Gamer RGB",
        cost_price: 15000,
        cost_price_tax: 2850,
        sale_price: 19500,
        quantity: 25,
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
      expect(rows[1].isValid).toBe(false); // New sale price is intentionally unassigned.
      expect(rows[2].isValid).toBe(true);

      // Check existing product matching
      const existingMatch = rows.find((r) => r.code === "SKU-EXISTING");
      expect(existingMatch).toBeDefined();
      expect(existingMatch?.id).toBe("prod-existing-1");
      expect(existingMatch?.isUpdate).toBe(true);
      expect(existingMatch?.cost_price).toBe(5500);
      expect(existingMatch?.quantity).toBe(20);

      // Check new product
      const newMatch = rows.find((r) => r.code === "SKU-BRAND-NEW");
      expect(newMatch).toBeDefined();
      expect(newMatch?.id).toBeUndefined();
      expect(newMatch?.isUpdate).toBe(false);
    });

    it("derives missing net cost from gross cost and supplier tax", () => {
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
      expect(rows[0].cost_price).toBe(5000);
      expect(rows[0].cost_price_tax).toBe(5950);
      expect(rows[0].sale_price).toBeNaN();
    });

    it("derives missing gross cost from net cost and supplier tax", () => {
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
      expect(rows[0].cost_price_tax).toBe(5950);
      expect(rows[0].sale_price).toBeNaN();
    });

    it("leaves missing extracted costs invalid for manual review", () => {
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
      expect(rows[0].cost_price).toBeNaN();
      expect(rows[0].cost_price_tax).toBeNaN();
      expect(rows[0].sale_price).toBeNaN();
      expect(rows[0].isValid).toBe(false);
    });

    it("preserves historical information without inventing a sale price for a new product", () => {
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
          sale_price: 12495,
          stock: 8,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ];

      const rows = mapExtractedItemsToRows(items, [], historicalLogs);
      expect(rows).toHaveLength(1);
      expect(rows[0].cost_price_tax).toBe(11900);
      expect(rows[0].sale_price).toBeNaN();
      expect(rows[0].historicalProduct?.sale_price).toBe(12495);
      expect(rows[0].priceDiff).toBeNull();
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
      expect(rows[0].sale_price).toBeNaN();
      expect(rows[0].isValid).toBe(false);
    });
  });
});

describe("ProductInvoiceImport Component", () => {
  const user = userEvent.setup();
  const mockOnCancel = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reserveObservation).mockReset().mockImplementation(async () => ({ version: 1, id: crypto.randomUUID() }));
    vi.mocked(businessServices.getProviders).mockResolvedValue({ data: [{ id: "prov-1", name: "Distribuidora Central", business_id: "biz-123", tax: 19, is_active: true, created_at: "" }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 50 } });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    useGeneralSettingsStore.setState({
      isLoaded: false,
    });
  });

  const classifyNewProducts = async () => {
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const expand = screen.queryByRole("button", { name: "Mostrar cantidad de la factura y disponibilidad" });
    if (expand) await user.click(expand);
    const newCodes = screen.queryAllByRole("button", { name: /Disponibilidad/ }).filter(select => !select.hasAttribute("disabled") && select.getAttribute("aria-disabled") !== "true").map(select => select.closest("tr")?.querySelectorAll("td")[2]?.textContent);
    for (const code of newCodes) {
      const row = screen.queryAllByTestId(/^invoice-row-/).find(candidate => candidate.querySelectorAll("td")[2]?.textContent === code);
      if (!row) continue;
      const trigger = within(row).getByRole("button", { name: /Acciones del producto/ });
      if (trigger.hasAttribute("disabled")) continue;
      await user.click(trigger);
      await user.click(screen.getByRole("menuitem", { name: "Editar fila" }));
      await user.click(screen.getByRole("button", { name: "Usar precio sugerido" }));
      await user.click(screen.getByTestId("save-row-edit"));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    }
    const selects = screen.queryAllByRole("button", { name: /Disponibilidad/ });
    for (const select of selects) {
      if (select.hasAttribute("disabled") || select.getAttribute("aria-disabled") === "true") continue;
      await user.click(select);
      const option = screen.queryByRole("option", { name: "Disponible" });
      if (option) await user.click(option);
    }
  };
  const selectProvider = async () => {
    const trigger = screen.getByRole("button", { name: /Proveedor vinculado/i });
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "Distribuidora Central" });
    await user.click(option);
    await waitFor(() => expect(screen.getByTestId("invoice-file-input")).toBeEnabled());
  };
  it("keeps a blocked Gemini selection and its file, and checks availability without starting OCR", async () => {
    const selected = { id: "blocked-instance", key: "gemini", name: "Synthetic Gemini selected", mode: "agentic", is_active: true,
      can_use_model: false, availability_reason: "runtime_busy" as const, error: "Synthetic unavailability", is_default: true, use_agentic: true,
      default_mode: "agentic", fields: { selected_model: "synthetic-selected-model" } };
    const other = { ...selected, id: "other-instance", name: "Synthetic other available", is_default: false, can_use_model: true, availability_reason: null, error: null };
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([selected, other]).mockResolvedValueOnce([{ ...selected, can_use_model: true, availability_reason: null, error: null }, other]);
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    const file = new File(["synthetic"], "synthetic-preserved.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    expect(screen.getByRole("button", { name: /Proveedor de IA/ })).toHaveTextContent("Synthetic Gemini selected");
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    await user.click(screen.getByTestId("check-invoice-ai-availability-btn"));
    await waitFor(() => expect(screen.getByTestId("analyze-invoice-btn")).toBeEnabled());
    expect(businessServices.analyzeInvoice).not.toHaveBeenCalled();
    expect(businessServices.verifyIaProviders).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/synthetic-preserved.pdf/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Proveedor de IA/ })).toHaveTextContent("Synthetic Gemini selected");
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce(syntheticAnalysis("SYNTHETIC-AFTER-CHECK"));
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await waitFor(() => expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce());
    expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(expect.objectContaining({ file, ai_provider_id: selected.id }));
  });
  it("explains a quarantined runtime without claiming logout, and replaces retry with a GET-only check", async () => {
    const selected = { id: "exact-instance", key: "gemini", name: "Synthetic exact Gemini", mode: "agentic", is_active: true,
      can_use_model: true, is_default: true, use_agentic: true, default_mode: "agentic", fields: { selected_model: "synthetic-exact-model" } };
    const pending = deferred<Awaited<ReturnType<typeof businessServices.verifyIaProviders>>>();
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([selected]).mockImplementationOnce(() => pending.promise);
    vi.mocked(businessServices.analyzeInvoice).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { upstreamErrorCode: "runtime_busy", message: "synthetic raw status" } } });
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    const file = new File(["synthetic"], "synthetic-busy.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    const check = await screen.findByTestId("retry-analyze-btn");
    expect(check).toHaveTextContent("Comprobar disponibilidad");
    expect(screen.getByText(/El motor de IA está ocupado/)).toBeVisible();
    expect(screen.queryByText(/cookies han expirado|sesión no está activa|synthetic raw status/)).not.toBeInTheDocument();
    await user.click(check);
    expect(check).toBeDisabled();
    expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve([{ ...selected, can_use_model: false, availability_reason: "runtime_busy", error: "synthetic blocked" }]); });
    await waitFor(() => expect(check).toBeEnabled());
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(expect.objectContaining({ file, ai_provider_id: selected.id, model: "synthetic-exact-model", mode: "agentic" }));
    expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce();
    expect(screen.getByText(/synthetic-busy.pdf/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Proveedor de IA/ })).toHaveTextContent("Synthetic exact Gemini");
  });
  it("does not reuse cached availability after a failed closure-state GET and recovers only on an explicit successful check", async () => {
    const selected = { id: "closure-instance", key: "gemini", name: "Synthetic closure Gemini", mode: "agentic", is_active: true,
      can_use_model: true, is_default: true, use_agentic: true, default_mode: "agentic", fields: { selected_model: "synthetic-closure-model" } };
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([selected]).mockRejectedValueOnce(new Error("synthetic GET unavailable")).mockResolvedValueOnce([selected]);
    vi.mocked(businessServices.analyzeInvoice).mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { upstreamErrorCode: "native_proof_missing", message: "synthetic raw proof status" } } });
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    await user.upload(screen.getByTestId("invoice-file-input"), new File(["synthetic"], "synthetic-proof.pdf", { type: "application/pdf" }));
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    const check = await screen.findByTestId("retry-analyze-btn");
    expect(screen.getByText(/No se pudo confirmar que el análisis haya finalizado/)).toBeVisible();
    await user.click(check);
    await waitFor(() => expect(check).toBeEnabled());
    expect(businessServices.verifyIaProviders).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(screen.getByText(/synthetic-proof.pdf/)).toBeVisible();
    expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce();
    await user.click(check);
    await waitFor(() => expect(screen.getByTestId("analyze-invoice-btn")).toBeEnabled());
    expect(businessServices.verifyIaProviders).toHaveBeenCalledTimes(3);
    expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce();
  });
  it("blocks an open manual match when its parent business changes without remounting the scope guard", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({ business_id: 'biz-123', provider_id: 'prov-1', code: 'SYNTHETIC-SCOPE', total_amount: 100,
      data: { items: [{ code: 'INV-SCOPE', name: 'Synthetic invoice', quantity: 1, cost_price: 100, cost_price_tax: 119 }] } });
    const client = createTestQueryClient();
    const page = (businessId: string) => <QueryClientProvider client={client}><ProductInvoiceImport businessId={businessId} onCancel={mockOnCancel} onSuccess={mockOnSuccess} /></QueryClientProvider>;
    const view = render(page('biz-123'));
    await selectProvider();
    await user.upload(screen.getByTestId('invoice-file-input'), new File(['synthetic'], 'synthetic.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByTestId('analyze-invoice-btn'));
    await user.click(await screen.findByTestId('invoice-row-actions-0'));
    await user.click(screen.getByRole('menuitem', { name: 'Vincular con un producto existente' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    view.rerender(page('another-business'));
    expect(screen.getByText('La sesión o el negocio cambió. Cierra esta ventana y vuelve a seleccionar el producto.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Preparar actualización' })).toBeDisabled();
    expect(businessServices.createInvoiceWithFile).not.toHaveBeenCalled();
    expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
  });
  it("starts a single analysis on double click and retains the active console", async () => {
    let release!: (value: Awaited<ReturnType<typeof businessServices.analyzeInvoice>>) => void;
    vi.mocked(businessServices.analyzeInvoice).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    await user.upload(screen.getByTestId("invoice-file-input"), new File(['synthetic'], 'synthetic.pdf', { type: 'application/pdf' }));
    await user.dblClick(screen.getByTestId("analyze-invoice-btn"));
    await waitFor(() => expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce());
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(within(screen.getByTestId('analysis-console')).getByText('Analizando')).toBeVisible();
    release({ business_id: 'biz-123', provider_id: 'prov-1', code: 'SYNTHETIC', total_amount: 0, data: { items: [] } });
    await waitFor(() => expect(within(screen.getByTestId('analysis-console')).getByText('Borrador listo')).toBeVisible());
  });

  it("cancels a slow reservation without sending OCR and ignores its late receipt", async () => {
    const reservation = deferred<Awaited<ReturnType<typeof reserveObservation>>>();
    const availability = deferred<Awaited<ReturnType<typeof businessServices.verifyIaProviders>>>();
    const selected = { id: "cancel-instance", key: "gemini", name: "Synthetic cancel Gemini", mode: "agentic", is_active: true,
      can_use_model: true, is_default: true, use_agentic: true, default_mode: "agentic", fields: { selected_model: "synthetic-cancel-model" } };
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([selected]).mockReturnValueOnce(availability.promise);
    vi.mocked(reserveObservation).mockReturnValueOnce(reservation.promise);
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    const file = new File(["synthetic"], "synthetic-cancel.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await waitFor(() => expect(within(screen.getByTestId("analysis-console")).getByText("Preparando")).toBeVisible());
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(screen.getByTestId("invoice-file-input")).toBeDisabled();
    const cancel = screen.getByTestId("cancel-invoice-analysis-btn");
    expect(cancel).toBeEnabled();
    await user.click(cancel);
    expect(vi.mocked(reserveObservation).mock.calls[0][1].aborted).toBe(true);
    expect(within(screen.getByTestId("analysis-console")).getByText("Espera cancelada")).toBeVisible();
    expect(screen.getByText(/synthetic-cancel.pdf/)).toBeVisible();
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(screen.getByTestId("invoice-file-input")).toBeDisabled();
    expect(businessServices.verifyIaProviders).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId("analyze-invoice-btn"));
    expect(businessServices.analyzeInvoice).not.toHaveBeenCalled();
    await act(async () => { availability.resolve([selected]); });
    await waitFor(() => expect(screen.getByTestId("analyze-invoice-btn")).toBeEnabled());
    await act(async () => { reservation.resolve({ version: 1, id: crypto.randomUUID() }); await reservation.promise; });
    expect(businessServices.analyzeInvoice).not.toHaveBeenCalled();
    expect(within(screen.getByTestId("analysis-console")).getByText("Espera cancelada")).toBeVisible();
    expect(sileo.success).toHaveBeenCalledWith(expect.objectContaining({ title: "Análisis cancelado" }));
  });

  it("preserves the draft on cancellation and keeps a new intent busy when the old OCR response arrives late", async () => {
    const late = deferred<Awaited<ReturnType<typeof businessServices.analyzeInvoice>>>();
    const current = deferred<Awaited<ReturnType<typeof businessServices.analyzeInvoice>>>();
    vi.mocked(businessServices.analyzeInvoice).mockReset().mockResolvedValueOnce(syntheticAnalysis("BASE-DRAFT"))
      .mockReturnValueOnce(late.promise).mockReturnValueOnce(current.promise);
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    const file = new File(["synthetic"], "synthetic-draft.pdf", { type: "application/pdf" });
    await user.upload(screen.getByTestId("invoice-file-input"), file);
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await screen.findByDisplayValue("BASE-DRAFT");
    fireEvent.change(screen.getByTestId("invoice-code-field").querySelector("input")!, { target: { value: "MY-LOCAL-DRAFT" } });
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await waitFor(() => expect(businessServices.analyzeInvoice).toHaveBeenCalledTimes(2));
    await user.click(screen.getByTestId("cancel-invoice-analysis-btn"));
    expect(vi.mocked(businessServices.analyzeInvoice).mock.calls[1][0].signal?.aborted).toBe(true);
    expect(screen.getByDisplayValue("MY-LOCAL-DRAFT")).toBeVisible();
    expect(screen.getByText("Synthetic SYNTHETIC-NEW")).toBeVisible();
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await waitFor(() => expect(businessServices.analyzeInvoice).toHaveBeenCalledTimes(3));
    await act(async () => { late.resolve(syntheticAnalysis("LATE-OLD", "OLD-ROW")); await late.promise; });
    expect(screen.queryByDisplayValue("LATE-OLD")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("MY-LOCAL-DRAFT")).toBeVisible();
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(within(screen.getByTestId("analysis-console")).getByText("Analizando")).toBeVisible();
    expect(screen.queryByTestId("retry-analyze-btn")).not.toBeInTheDocument();
    await act(async () => { current.resolve(syntheticAnalysis("CURRENT-RESULT", "CURRENT-ROW")); await current.promise; });
    expect(await screen.findByDisplayValue("CURRENT-RESULT")).toBeVisible();
    expect(screen.getByText("Synthetic CURRENT-ROW")).toBeVisible();
    expect(screen.queryByText("Synthetic OLD-ROW")).not.toBeInTheDocument();
    expect(vi.mocked(businessServices.analyzeInvoice).mock.calls[2][0].file).toBe(file);
    expect(businessServices.createInvoiceWithFile).not.toHaveBeenCalled();
  });

  it("keeps all previous fields while history prepares and aborts that read without applying a late draft", async () => {
    const history = deferred<Awaited<ReturnType<typeof businessServices.getProductLogs>>>();
    vi.mocked(businessServices.getProductLogs).mockReturnValueOnce(history.promise);
    vi.mocked(businessServices.analyzeInvoice).mockReset().mockResolvedValueOnce(syntheticAnalysis("BEFORE-HISTORY"))
      .mockResolvedValueOnce(syntheticAnalysis("SHOULD-NOT-APPLY", "SKU-EXISTING"));
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    await user.upload(screen.getByTestId("invoice-file-input"), new File(["synthetic"], "synthetic-history.pdf", { type: "application/pdf" }));
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await screen.findByDisplayValue("BEFORE-HISTORY");
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    await waitFor(() => expect(businessServices.getProductLogs).toHaveBeenCalledOnce());
    expect(within(screen.getByTestId("analysis-console")).getByText("Preparando borrador")).toBeVisible();
    expect(screen.getByDisplayValue("BEFORE-HISTORY")).toBeDisabled();
    expect(screen.queryByDisplayValue("SHOULD-NOT-APPLY")).not.toBeInTheDocument();
    expect(screen.getByTestId("invoice-file-input")).toBeDisabled();
    expect(screen.getByTestId("analyze-invoice-btn")).toBeDisabled();
    expect(screen.getByTestId("invoice-row-actions-0")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Proveedor vinculado/i })).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByTestId("cancel-invoice-analysis-btn"));
    expect(vi.mocked(businessServices.getProductLogs).mock.calls[0][1]?.aborted).toBe(true);
    await act(async () => { history.resolve({ data: [], meta: { page: 1, limit: 25, total_items: 0, total_pages: 0 } }); await history.promise; });
    expect(screen.getByDisplayValue("BEFORE-HISTORY")).toBeEnabled();
    expect(screen.queryByDisplayValue("SHOULD-NOT-APPLY")).not.toBeInTheDocument();
    expect(screen.getByText("Synthetic SYNTHETIC-NEW")).toBeVisible();
    expect(within(screen.getByTestId("analysis-console")).getByText("Espera cancelada")).toBeVisible();
    expect(screen.getByTestId("analyze-invoice-btn")).toBeEnabled();
    expect(businessServices.createInvoiceWithFile).not.toHaveBeenCalled();
    expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
  });

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

    vi.mocked(businessServices.getProviders).mockResolvedValue({ data: [{ id: "prov-2", name: "Importadora Andes", business_id: "biz-123", tax: 19, is_active: true, created_at: "" }], meta: { total_items: 1, total_pages: 1, page: 1, limit: 50 } });
    // Search is resolved by the server and keeps the selected ID.
    const searchInput = screen.getByPlaceholderText(/buscar proveedor|buscar/i);
    await user.type(searchInput, "Andes");

    expect(screen.getByRole("option", { name: "Importadora Andes" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("option", { name: "Distribuidora Central" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("option", { name: "Importadora Andes" })).toBeEnabled());

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
    expect(screen.getByTestId("error-dot-1")).toBeInTheDocument();

    // The save button MUST be disabled because of errors
    await classifyNewProducts();
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
    await user.click(screen.getByTestId("invoice-row-actions-0"));
    await user.click(screen.getByRole("menuitem", { name: "Editar fila" }));

    expect(screen.getByTestId("edit-field-code")).toBeInTheDocument();

    // Fill code
    const codeInput = screen.getByTestId("edit-field-code").querySelector("input")!;
    await user.type(codeInput, "SKU-USB-C");

    await user.click(screen.getByRole("button", { name: "Usar precio sugerido" }));
    await user.click(screen.getByRole("button", { name: "Usar precio sugerido" }));
    // Save dialog
    await user.click(screen.getByTestId("save-row-edit"));

    // Now it should have a valid green dot and the save button is enabled
    await waitFor(() => {
      expect(screen.getByTestId("valid-dot-0")).toBeInTheDocument();
    });

    await classifyNewProducts();
    const saveBtn = screen.getByTestId("submit-invoice-products");
    expect(saveBtn).not.toBeDisabled();
  });

  it("stops product writes when invoice creation fails", async () => {
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
      expect(screen.getByTestId("error-dot-0")).toBeInTheDocument();
    });

    await classifyNewProducts();
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

  it("creates invoice first, then saves products through separate requests", async () => {
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
      expect(screen.getByTestId("error-dot-0")).toBeInTheDocument();
    });

    await classifyNewProducts();
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
      expect(screen.getByTestId("invoice-row-actions-0")).toBeInTheDocument();
    });

    // Open edit modal
    await user.click(screen.getByTestId("invoice-row-actions-0"));
    await user.click(screen.getByRole("menuitem", { name: "Editar fila" }));

    // Modal title & Core active switch
    expect(screen.getByRole("heading", { name: /Editar Producto Extraído/i })).toBeInTheDocument();
    expect(screen.getByTestId("edit-field-active-switch")).toBeInTheDocument();

    const costInput = screen.getByTestId("edit-field-cost").querySelector("input")!;
    const taxRateInput = screen.getByTestId("edit-field-tax-rate").querySelector("input")!;
    const costTaxInput = screen.getByTestId("edit-field-cost-tax").querySelector("input")!;
    const saleInput = screen.getByTestId("edit-field-sale").querySelector("input")!;

    // Initial values
    expect(costInput).toHaveValue(1000);
    expect(taxRateInput).toHaveValue(19);
    expect(costTaxInput).toHaveValue(1190);
    expect(screen.queryByTestId("edit-field-margin")).not.toBeInTheDocument();
    expect(saleInput).toHaveValue(null);

    // 1. Changing cost recalculates cost with tax and sale price
    await user.clear(costInput);
    await user.type(costInput, "2000");
    expect(costTaxInput).toHaveValue(2380);
    expect(saleInput).toHaveValue(null);

    // 2. Changing tax rate recalculates cost with tax and sale price
    await user.clear(taxRateInput);
    await user.type(taxRateInput, "10");
    expect(costTaxInput).toHaveValue(2200);
    expect(saleInput).toHaveValue(null);

    // 3. Changing cost with tax recalculates cost base and sale price
    await user.clear(costTaxInput);
    await user.type(costTaxInput, "3300");
    expect(costInput).toHaveValue(3000);
    expect(saleInput).toHaveValue(null);

    // 4. Changing sale price recalculates margin percentage
    await user.clear(saleInput);
    await user.type(saleInput, "4950");
    expect(costInput).toHaveValue(3000);
    expect(costTaxInput).toHaveValue(3300);

    // 5. Save changes
    await user.click(screen.getByTestId("save-row-edit"));

    // Modal is closed
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /Editar Producto Extraído/i })).not.toBeInTheDocument();
    });

    // Row reflects updated data in table
    expect(screen.getByText(/\$3[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/\$4[.,]950/)).toBeInTheDocument();
    expect(screen.queryByTestId("edit-field-margin")).not.toBeInTheDocument();
  }, 15_000);

  it("collapses quantity and availability without losing values or misaligning historical rows", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123", provider_id: "prov-1", code: "FAC-DETAILS", total_amount: 5000,
      data: { items: [{ code: "SKU-EXISTING", name: "Producto existente", quantity: 3, unit_price: 1000, total_price: 3000 }] },
    });
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    await user.upload(screen.getByTestId("invoice-file-input"), new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" }));
    await user.click(screen.getByTestId("analyze-invoice-btn"));
    const row = await screen.findByTestId("invoice-row-0");
    const history = screen.getByTestId("historical-row-0");
    expect(within(row).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(row).getAllByRole("cell")).toHaveLength(8);
    expect(within(history).getAllByRole("cell")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Mostrar cantidad de la factura y disponibilidad" }));
    expect(within(row).getAllByRole("cell")).toHaveLength(10);
    expect(within(history).getAllByRole("cell")).toHaveLength(10);
    expect(within(row).getByRole("cell", { name: "3" })).toBeVisible();
    const expandedRow = row.textContent;
    await user.click(screen.getByRole("button", { name: "Ocultar cantidad de la factura y disponibilidad" }));
    expect(screen.queryByRole("columnheader", { name: "Cantidad de la factura" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mostrar cantidad de la factura y disponibilidad" }));
    expect(row.textContent).toBe(expandedRow);
    expect(screen.getByDisplayValue("FAC-DETAILS")).toBeInTheDocument();
    expect(businessServices.analyzeInvoice).toHaveBeenCalledOnce();
    expect(businessServices.createInvoiceWithFile).not.toHaveBeenCalled();
    expect(businessServices.bulkUpdateProducts).not.toHaveBeenCalled();
  });

  it("preserves the catalog sale price and renders the historical comparison without action buttons", async () => {
    vi.mocked(businessServices.getProductLogs).mockResolvedValueOnce({
      data: [
        {
          id: "log-sku-hist",
          product_id: "prod-existing-1",
          code: "SKU-EXISTING",
          name: "Producto Existente Historial",
          cost_price: 5000,
          cost_price_tax: 5950,
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
    expect(screen.queryByText("40%")).not.toBeInTheDocument();

    // Price diff indicator is rendered with red up arrow and +60%
    const priceDiffBadge = screen.getByTestId("price-diff-0");
    expect(priceDiffBadge).toBeInTheDocument();
    expect(priceDiffBadge).toHaveTextContent("-15%");

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
    expect(priceDiffBadge).toHaveTextContent("-50%");
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
      isAxiosError: true,
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

  it("analyzes invoice with Mistral OCR when selecting Mistral, sending the selected instance ID", async () => {
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

    // Select Mistral from AI Provider dropdown
    const aiProviderTrigger = screen.getByRole("button", { name: /Proveedor de IA/i });
    await user.click(aiProviderTrigger);
    const mistralOption = await screen.findByRole("option", { name: /Gemini Secundario/i });
    await user.click(mistralOption);

    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    expect(analyzeBtn).toBeInTheDocument();
    expect(analyzeBtn).not.toBeDisabled();

    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: "biz-123",
          provider_id: "prov-1",
          ai_provider: "gemini",
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("invoice-results-section")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("FAC-MISTRAL-001")).toBeInTheDocument();
  });

  it("disables the analyze button when selected provider has can_use_model=false", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([{ id: "ai-primary", key: "gemini", name: "Google Gemini", mode: "api_key", is_active: true, can_use_model: true, is_default: true, use_api_key: true, default_mode: "api_key", fields: { selected_model: "model-current" } }, { id: "ai-secondary", key: "gemini", name: "Gemini Secundario", mode: "api_key", is_active: true, can_use_model: false, use_api_key: true, default_mode: "api_key", fields: { selected_model: "model-secondary" } }]);

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

    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    expect(analyzeBtn).not.toBeDisabled();

    // Select Mistral (which is inactive / can_use_model=false)
    const aiProviderTrigger = screen.getByRole("button", { name: /Proveedor de IA/i });
    await user.click(aiProviderTrigger);
    const mistralOption = await screen.findByRole("option", { name: /Gemini Secundario/i });
    await user.click(mistralOption);

    await waitFor(() => {
      expect(analyzeBtn).toBeDisabled();
    });
  });

  it("disables the analyze button when default provider has can_use_model=false, and enables when selecting an active provider", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([{ id: "ai-primary", key: "gemini", name: "Google Gemini", mode: "api_key", is_active: true, can_use_model: false, is_default: true, use_api_key: true, default_mode: "api_key", fields: { selected_model: "model-current" } }, { id: "ai-secondary", key: "gemini", name: "Gemini Secundario", mode: "api_key", is_active: true, can_use_model: true, use_api_key: true, default_mode: "api_key", fields: { selected_model: "model-secondary" } }]);

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

    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    // Gemini is default, but inactive -> button disabled
    await waitFor(() => {
      expect(analyzeBtn).toBeDisabled();
    });

    // Select Mistral (which is active)
    const aiProviderTrigger = screen.getByRole("button", { name: /Proveedor de IA/i });
    await user.click(aiProviderTrigger);
    const mistralOption = await screen.findByRole("option", { name: /Gemini Secundario/i });
    await user.click(mistralOption);

    await waitFor(() => {
      expect(analyzeBtn).not.toBeDisabled();
    });
  });

  it("renders dynamic provider options from array response and respects can_use_model and thinking support", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([
      {
        id: "prov-gemini",
        key: "gemini",
        name: "Google Gemini",
        mode: "agentic",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: true,
        use_agentic: true,
        default_mode: "agentic",
        fields: {
          selected_model: "gemini-3.8-flash",
          enable_extended_thinking: true,
          available_models: [{ id: "gemini-3.8-flash", capabilities: ["reasoning"] }],
        },
        default_model: "gemini-3.8-flash",
        ocr_model: null,
        supports_thinking: true,
        extended_thinking_enabled: true,
      },
      {
        id: "prov-mistral",
        key: "gemini",
        name: "Gemini Secundario",
        mode: "api_key",
        is_active: true,
        can_use_model: false,
        error: "No cuenta con API Keys activas",
        is_default: false,
        use_api_key: true,
        default_mode: "agentic",
        fields: {
          selected_model: "mistral-large-latest",
        },
        default_model: "mistral-large-latest",
        ocr_model: null,
        supports_thinking: false,
        extended_thinking_enabled: false,
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

    expect(screen.queryByTestId("use-thinking-mode-checkbox")).not.toBeInTheDocument();

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");

    await waitFor(() => {
      expect(analyzeBtn).not.toBeDisabled();
      expect(screen.queryByRole("group", { name: "Razonamiento" })).not.toBeInTheDocument();
    });

    // Switch to Mistral (disabled and no thinking support)
    const aiProviderTrigger = screen.getByRole("button", { name: /Proveedor de IA/i });
    await user.click(aiProviderTrigger);
    const mistralOption = await screen.findByRole("option", { name: /Gemini Secundario/i });
    await user.click(mistralOption);

    await waitFor(() => {
      expect(analyzeBtn).toBeDisabled();
      expect(screen.queryByTestId("use-thinking-mode-checkbox")).not.toBeInTheDocument();
    });
  });

  it("keeps the assigned model when OCR focus is configured and sends the saved Agentic level", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([
      {
        id: "prov-mistral-ocr",
        key: "gemini",
        name: "Gemini Secundario",
        mode: "agentic",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: true,
        use_agentic: true,
        default_mode: "agentic",
        fields: {
          selected_model: "mistral-large-latest",
          ocr_model: "mistral-large-latest",
          enable_extended_thinking: true,
          thinking_level: "medium",
          available_models: [{ id: "mistral-large-latest", capabilities: ["reasoning"] }],
        },
        default_model: "mistral-large-latest",
        ocr_model: "mistral-large-latest",
        supports_thinking: true,
        extended_thinking_enabled: true,
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

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);


    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_provider: "gemini",
          ai_provider_id: "prov-mistral-ocr",
          model: "mistral-large-latest",
          model_type: "default",
          thinking_level: "medium",
          extended_thinking: undefined,
        })
      );
    });
  });

  it("sends the selected API model's reasoning preference without inheriting Agentic or Web options", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([{
      id: 'api-instance', key: 'openai', name: 'API connection', mode: 'api_key', is_active: true,
      can_use_model: true, is_default: true, use_api_key: true, default_mode: 'api_key',
      fields: { api_key: { selected_model: 'account-model', thinking_levels: { 'account-model': 'high' }, thinking_level: 'low' },
        agentic: { thinking_level: 'medium' }, },
    }]);
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: 'biz-123', provider_id: 'prov-1', code: 'SYNTHETIC-API', total_amount: null,
      data: { issue_date: undefined, items: [] },
    });
    renderWithClient(<ProductInvoiceImport businessId="biz-123" onCancel={mockOnCancel} onSuccess={mockOnSuccess} />);
    await selectProvider();
    await user.upload(screen.getByTestId('invoice-file-input'), new File(['synthetic'], 'invoice.pdf', { type: 'application/pdf' }));
    const analyze = screen.getByTestId('analyze-invoice-btn');
    await waitFor(() => expect(analyze).toBeEnabled());
    await user.click(analyze);
    await waitFor(() => expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(expect.objectContaining({
      ai_provider_id: 'api-instance', mode: 'api_key', model: 'account-model', thinking_level: 'high',
      extended_thinking: undefined,
    })));
    expect(vi.mocked(businessServices.analyzeInvoice).mock.calls[0][0]).not.toHaveProperty('engine');
  });

  it("auto-selects the default provider with badge and shows mode select with active mode when single or multiple active modes exist", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([
      {
        id: "prov-gemini",
        key: "gemini",
        name: "Google Gemini",
        mode: "agentic",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: true,
        use_agentic: true,
        default_mode: "agentic",
        fields: {
          selected_model: "gemini-2.5-pro",
        },
        default_model: "gemini-2.5-pro",
        ocr_model: null,
        supports_thinking: false,
        extended_thinking_enabled: false,
      },
      {
        id: "prov-mistral",
        key: "gemini",
        name: "Gemini Secundario",
        mode: "api_key",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: false,
        use_api_key: true,
        default_mode: "agentic",
        fields: {
          selected_model: "mistral-large-latest",
        },
        default_model: "mistral-large-latest",
        ocr_model: null,
        supports_thinking: false,
        extended_thinking_enabled: false,
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

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    // AI Provider selector should have Gemini (Predeterminado) selected
    await waitFor(() => {
      expect(screen.getByTestId("ai-provider-select")).toBeInTheDocument();
      expect(screen.getByText(/Google Gemini \(Predeterminado\)/i)).toBeInTheDocument();
    });

    // Gemini has 2 modes (agentic and web), so ai-mode-select should be visible!
    expect(screen.getByTestId("ai-mode-select")).toBeInTheDocument();

    // Now switch provider to Mistral (which has only 1 mode: use_api_key)
    const aiProviderTrigger = screen.getByRole("button", { name: /Proveedor de IA/i });
    await user.click(aiProviderTrigger);
    const mistralOption = await screen.findByRole("option", { name: "Gemini Secundario" });
    await user.click(mistralOption);

    // Now ai-mode-select should remain visible, displaying only the active Api Key mode
    await waitFor(() => {
      expect(screen.getByTestId("ai-mode-select")).toBeInTheDocument();
      expect(screen.getByText(/API key/i)).toBeInTheDocument();
    });
  });

  it("renders mode selector with only Api Key option when OpenAI provider (Chatgpt pega) is configured with api_key", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([
      {
        id: "prov-chatgpt",
        key: "openai",
        name: "Chatgpt pega",
        mode: "api_key",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: true,
        use_api_key: true,
        use_agentic: false,
        default_mode: "api_key",
        fields: {
          selected_model: "gpt-4o",
        },
        default_model: "gpt-4o",
        ocr_model: null,
        supports_thinking: false,
        extended_thinking_enabled: false,
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

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByTestId("ai-provider-select")).toBeInTheDocument();
      expect(within(screen.getByTestId("ai-provider-select")).getByText(/Chatgpt pega/i)).toBeInTheDocument();
    });

    // The mode selector should be visible right next to the provider selector
    const modeSelect = screen.getByTestId("ai-mode-select");
    expect(modeSelect).toBeInTheDocument();
    expect(screen.getByText(/API key/i)).toBeInTheDocument();

    // Opening the mode selector should only show the Api Key option
    const modeTrigger = screen.getByRole("button", { name: /Método de Conexión/i });
    await user.click(modeTrigger);

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent(/API key/i);
  });

  it("passes the selected mode to analyzeInvoice when user changes connection mode", async () => {
    vi.mocked(businessServices.analyzeInvoice).mockResolvedValueOnce({
      business_id: "biz-123",
      provider_id: "prov-1",
      code: "FAC-MODE-001",
      total_amount: 10000,
      data: {
        issue_date: "2026-03-20",
        items: [],
      },
    });

    vi.mocked(businessServices.verifyIaProviders).mockImplementationOnce(async () => [
      {
        id: "prov-gemini",
        key: "gemini",
        name: "Google Gemini",
        mode: "agentic",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: true,
        use_agentic: true,
        use_api_key: true,
        default_mode: "agentic",
        fields: {
          agentic: { selected_model: "synthetic-agentic-model" },
          api_key: { selected_model: "synthetic-api-model" },
        },
        default_model: "gemini-2.5-pro",
        ocr_model: null,
        supports_thinking: false,
        extended_thinking_enabled: false,
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

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    // Gemini has 2 modes, so mode select is visible
    const modeSelectTrigger = await screen.findByRole("button", { name: /Método de Conexión/i });
    await user.click(modeSelectTrigger);

    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([{
      id: "prov-gemini", key: "gemini", name: "Google Gemini", mode: "api_key", active_mode: "api_key",
      is_active: true, can_use_model: true, error: null, is_default: true,
      use_agentic: true, use_api_key: true, default_mode: "agentic",
      fields: { agentic: { selected_model: "synthetic-agentic-model" }, api_key: { selected_model: "synthetic-api-model" } },
    }]);
    // Explicitly select the other supported mode
    const webOption = await screen.findByRole("option", { name: /API key/i });
    await user.click(webOption);

    // Click analyze
    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    await waitFor(() => expect(analyzeBtn).toBeEnabled());
    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: "biz-123",
          provider_id: "prov-1",
          ai_provider: "gemini",
          mode: "api_key",
        })
      );
    });
  });

  it("does not invent a thinking level when agentic configuration omits it", async () => {
    vi.mocked(businessServices.verifyIaProviders).mockResolvedValueOnce([
      {
        id: "prov-agentic-only",
        key: "gemini",
        name: "Google Gemini",
        mode: "agentic",
        is_active: true,
        can_use_model: true,
        error: null,
        is_default: true,
        use_agentic: true,
        default_mode: "agentic",
        fields: {
          agentic: {
            selected_model: "gemini-2.5-pro",
          },
        },
        default_model: "gemini-2.5-pro",
        ocr_model: null,
        supports_thinking: true,
        extended_thinking_enabled: true,
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

    const file = new File(["dummy"], "factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input");
    await user.upload(fileInput, file);

    // Thinking checkbox must NOT be rendered in agentic mode
    expect(screen.queryByTestId("use-thinking-mode-checkbox")).not.toBeInTheDocument();

    const analyzeBtn = screen.getByTestId("analyze-invoice-btn");
    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(businessServices.analyzeInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          business_id: "biz-123",
          provider_id: "prov-1",
          ai_provider: "gemini",
          ai_provider_id: "prov-agentic-only",
          mode: "agentic",
          thinking_level: undefined,
          extended_thinking: undefined,
        })
      );
    });
  });
  it("preserves zero quantities and flags absent or infinite extraction values", () => {
    const base = { code: "ZERO", name: "Zero stock", quantity: 0, cost_price: 0, cost_price_tax: 0 };
    expect(mapExtractedItemsToRows([base], [])[0]).toMatchObject({ quantity: 0, cost_price: 0, cost_price_tax: 0, isValid: false });
    expect(mapExtractedItemsToRows([{ ...base, quantity: null }], [])[0].isValid).toBe(false);
    expect(mapExtractedItemsToRows([{ ...base, quantity: Infinity }], [])[0].isValid).toBe(false);
    expect(mapExtractedItemsToRows([{ ...base, cost_price: Infinity, cost_price_tax: null }], [])[0].isValid).toBe(false);
  });
  it("calculates extracted unit prices using the selected supplier tax", () => {
    const [row] = mapExtractedItemsToRows([{ code: "TAX", name: "Taxed", unit_price: 100, quantity: 1 }], [], [], 10);
    expect(row.cost_price_tax).toBe(110);
    expect(row.sale_price).toBeNaN();
  });
  it("requires duplicate SKU rows to be reviewed and clears the error after removal", () => {
    const rows = mapExtractedItemsToRows([
      { code: "SKU", name: "First", quantity: 1, unit_price: 100 },
      { code: " sku ", name: "Repeated", quantity: 2, unit_price: 100 },
    ], []);
    expect(rows.every((row) => !row.isValid)).toBe(true);
    expect(rows[0].errors.join(" ")).toMatch(/repetido/i);
    expect(validateInvoiceRows([{ ...rows[0], sale_price: 130 }])[0].isValid).toBe(true);
  });
  it("does not calculate price changes from invalid values", () => {
    expect(calculatePriceDiff(NaN, 100)).toBeNull();
    expect(calculatePriceDiff(100, Infinity)).toBeNull();
  });

});
