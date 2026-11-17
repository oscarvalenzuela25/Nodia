import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import InvoicesTab from "../../../../../../../modules/business/pages/BusinessDetail/components/InvoicesTab/InvoicesTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import * as cashServices from "../../../../../../../modules/business/infrastructure/cashServices";
import type { InvoiceEntity, ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";
import { sileo } from "sileo";
import { notifyHttpError } from "../../../../../../../config/httpFeedback";
import useAuthStore from "../../../../../../../store/authStore";
import i18n from "../../../../../../../translate";

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
  getInvoices: vi.fn(),
  createInvoice: vi.fn(),
  createInvoiceWithFile: vi.fn(),
  updateInvoice: vi.fn(),
  getInvoiceEditSource: vi.fn(),
  getProviders: vi.fn(),
  getInvoiceViewUrl: vi.fn(),
}));

vi.mock("../../../../../../../modules/business/infrastructure/cashServices", async (importOriginal) => ({
  ...await importOriginal<typeof cashServices>(),
  getCashCategories: vi.fn(),
  getCashReceipt: vi.fn(),
  sendCashMutation: vi.fn(),
}));

const businessId = "6ca4ef5d-28d2-4214-affb-ff74b48b526f";
const requestKey = "c3f8bdd0-c4c3-429d-9bc2-998b3c7e512f";
const linkedCategory = { id: "31", name: "Insumos", is_active: false };
const movementId = "a820203c-1456-418d-852d-f2a690e3b4c2";
const createdCategory = { id: "32", name: "Operación", is_active: true, business_id: businessId, description: "Gastos", version: 1 };
const committed = (operation: "invoice_create" | "invoice_update") => ({
  operation, status: "committed" as const, request_key: requestKey, result: {
    invoice_id: "17", invoice_version: 9, cash_movement_id: movementId,
  },
});

const mockProviders: ProviderEntity[] = [
  {
    id: "prov-1",
    business_id: "biz-123",
    name: "Distribuidora Mayorista",
    tax: 19, use_ocr: false,
    fields: {},
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const mockInvoices: InvoiceEntity[] = [
  {
    id: "inv-1",
    business_id: "biz-123",
    provider_id: "prov-1",
    code: "FAC-MANUAL-001",
    total_amount: 550000,
    path_storage: "https://storage.nodia.app/invoices/fac-manual-001.pdf",
    data: {
      status: "paid",
      issue_date: "2026-02-10",
      notes: "Registrada manualmente",
    },
    is_active: true,
    created_at: "2026-02-10T10:00:00Z",
    provider: mockProviders[0],
  },
  {
    id: "inv-2",
    business_id: "biz-123",
    provider_id: "prov-1",
    code: "FAC-ANALYZED-002",
    total_amount: 1200000,
    path_storage: "https://storage.nodia.app/invoices/fac-analyzed-002.pdf",
    data: {
      status: "pending",
      issue_date: "2026-03-01",
      notes: "Procesada con análisis de factura",
    },
    is_active: true,
    created_at: "2026-03-01T12:00:00Z",
    provider: mockProviders[0],
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

describe("InvoicesTab Component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cashServices.sendCashMutation).mockReset();
    vi.mocked(cashServices.getCashReceipt).mockReset();
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test user" },
    });
    vi.mocked(cashServices.getCashCategories).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 25, total_pages: 0, total_items: 0 },
    });
    vi.mocked(cashServices.sendCashMutation).mockResolvedValue(committed("invoice_create"));
    vi.mocked(businessServices.getInvoiceEditSource).mockImplementation(async (id, invoiceId) => ({
      ...mockInvoices.find((invoice) => invoice.id === invoiceId)!,
      business_id: id,
      version: 7,
      cash_expense: null,
    }));
    vi.mocked(businessServices.getProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 1, page: 1, limit: 100, total_pages: 1 },
    });
    vi.mocked(businessServices.getInvoices).mockResolvedValue({
      data: mockInvoices,
      meta: { total_items: 2, page: 1, limit: 100, total_pages: 1 },
    });
  });

  it("renders table with both manual and analyzed invoices", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
      expect(screen.getByText("FAC-ANALYZED-002")).toBeInTheDocument();
    });

    expect(screen.getByText("Fecha de la factura")).toBeInTheDocument();
    expect(screen.getByText("10/02/2026")).toBeInTheDocument();
    expect(screen.getByText("01/03/2026")).toBeInTheDocument();
    expect(screen.getByText(/\$550[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/\$1[.,]200[.,]000/)).toBeInTheDocument();
    expect(screen.getByText("fac-manual-001.pdf")).toBeInTheDocument();
    expect(screen.getByText("fac-analyzed-002.pdf")).toBeInTheDocument();
  });

  it("preserves the file and invoice while creating its category and recovering a receipt", async () => {
    vi.mocked(cashServices.sendCashMutation)
      .mockImplementationOnce(async (_businessId, key) => ({
        request_key: key, operation: "category_create", status: "committed", result: { category: createdCategory },
      }))
      .mockImplementationOnce(async (_businessId, key) => ({
        request_key: key, operation: "invoice_create", status: "processing",
      }));
    vi.mocked(cashServices.getCashReceipt).mockImplementation(async (_businessId, key) => ({
      ...committed("invoice_create"),
      request_key: key,
    }));

    renderWithClient(<InvoicesTab businessId={businessId} />);

    // Click "Registrar Factura" button
    const newInvoiceBtn = screen.getByTestId("new-invoice-btn");
    await waitFor(() => expect(newInvoiceBtn).toBeEnabled());
    await user.click(newInvoiceBtn);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByText("Registrar Nueva Factura")).toBeInTheDocument();
    });

    // Upload an invoice file
    const file = new File(["test pdf content"], "mi-factura.pdf", { type: "application/pdf" });
    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByTestId("invoice-file-selected")).toBeInTheDocument();
    expect(screen.getByText("mi-factura.pdf")).toBeInTheDocument();

    // Fill fields manually
    const codeInput = screen.getByTestId("invoice-code-input").querySelector("input")!;
    const amountInput = screen.getByTestId("invoice-total-amount-input").querySelector("input")!;
    await user.type(codeInput, "FAC-NUEVA-777");
    await user.clear(amountInput);
    await user.type(amountInput, "300000");

    const categoryButton = screen.getByRole("button", { name: i18n.t("business:cash.category_add") });
    await waitFor(() => expect(categoryButton).toBeEnabled());
    await user.click(categoryButton);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.type(screen.getByRole("textbox", { name: `${i18n.t("business:cash.category_name")}*` }), createdCategory.name);
    await user.type(screen.getByRole("textbox", { name: `${i18n.t("business:description_label")}*` }), createdCategory.description);
    await user.click(screen.getByRole("button", { name: i18n.t("core:save") }));

    const picker = await screen.findByRole("button", { name: i18n.t("business:cash.expense_category") });
    await waitFor(() => expect(picker).toHaveFocus());
    expect(picker).toHaveTextContent(createdCategory.name);
    expect(screen.getByText("mi-factura.pdf")).toBeVisible();
    expect(screen.getByDisplayValue("FAC-NUEVA-777")).toBeVisible();
    const saveBtn = screen.getByTestId("save-invoice-btn");
    await user.click(saveBtn);

    const receipt = await screen.findByRole("button", { name: i18n.t("business:cash.receipt_check") });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText("mi-factura.pdf")).toBeVisible();
    expect(cashServices.sendCashMutation).toHaveBeenLastCalledWith(businessId, expect.any(String),
      expect.objectContaining({
        operation: "invoice_create",
        fields: expect.objectContaining({ code: "FAC-NUEVA-777", total_amount: 300000, cash_category_id: "32" }),
        file,
      })
    );
    const [, key] = vi.mocked(cashServices.sendCashMutation).mock.calls[1];
    await user.click(receipt);
    expect(cashServices.getCashReceipt).toHaveBeenCalledWith(businessId, key, expect.objectContaining({ file }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("renders table without status column", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    // Verify invoice_status column is not rendered in headers
    expect(screen.queryByRole("columnheader", { name: "Estado de actividad" })).not.toBeInTheDocument();
  });

  it("toggles invoice active status using 3-dots menu and ConfirmDialog", async () => {
    vi.mocked(businessServices.updateInvoice).mockResolvedValue({
      ...mockInvoices[0],
      is_active: false,
    });

    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    // 1. Click 3-dots actions button
    const actionsBtn = screen.getByTestId(`invoice-actions-btn-${mockInvoices[0].id}`);
    await user.click(actionsBtn);

    // 2. Click toggle action in menu
    const toggleMenuItem = await screen.findByTestId("menu-item-toggle-invoice");
    await user.click(toggleMenuItem);

    // 3. Confirm in ConfirmDialog
    const confirmBtn = await screen.findByRole("button", { name: /Desactivar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(businessServices.updateInvoice).toHaveBeenCalledTimes(1);
    });

    expect(businessServices.updateInvoice).toHaveBeenCalledWith(
      mockInvoices[0].id,
      { is_active: false }
    );
  });

  it("opens edit invoice modal from 3-dots actions menu", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    // 1. Click 3-dots actions button
    const actionsBtn = screen.getByTestId(`invoice-actions-btn-${mockInvoices[0].id}`);
    await user.click(actionsBtn);

    // 2. Click edit in menu
    const editMenuItem = await screen.findByTestId("menu-item-edit-invoice");
    await user.click(editMenuItem);

    // 3. Verify modal opened in edit mode
    expect((await screen.findByTestId("invoice-code-input")).querySelector("input")).toHaveValue("FAC-MANUAL-001");
  });

  it("renders visible invoices summary next to search with count, total amount, and tooltip info icon", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      // 2 mock invoices: 550,000 + 1,200,000 = 1,750,000
      expect(screen.getByTestId("invoices-visible-count")).toHaveTextContent("2");
    });

    expect(screen.getByTestId("invoices-visible-summary")).toBeInTheDocument();
    expect(screen.getByTestId("invoices-visible-total")).toHaveTextContent(/\$1[.,]750[.,]000/);
    expect(screen.getByTestId("invoices-visible-info-icon")).toBeInTheDocument();
  });

  it("renders filter modal, allows setting date range, displays active chips, and calls getInvoices with date range", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    // 1. Open Filter modal
    const filterBtn = screen.getByRole("button", { name: /^abrir filtros/i });
    await user.click(filterBtn);

    await waitFor(() => {
      expect(screen.getByText("Filtros de facturas")).toBeInTheDocument();
    });

    // 2. Set Date From & Date To
    const fromInput = screen.getByTestId("filter-invoice-date-from-input").querySelector("input");
    const toInput = screen.getByTestId("filter-invoice-date-to-input").querySelector("input");
    if (fromInput) await user.type(fromInput, "2026-02-01");
    if (toInput) await user.type(toInput, "2026-02-28");

    // 3. Apply filters
    const applyBtn = screen.getByRole("button", { name: /^filtrar$/i });
    await user.click(applyBtn);

    // 4. Verify chips
    await waitFor(() => {
      expect(screen.getByText(/Desde:\s*01\/02\/2026/i)).toBeInTheDocument();
      expect(screen.getByText(/Hasta:\s*28\/02\/2026/i)).toBeInTheDocument();
    });

    // 5. Verify getInvoices was called with issue_date_gteq and issue_date_lteq
    expect(businessServices.getInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.objectContaining({
          issue_date_gteq: "2026-02-01",
          issue_date_lteq: "2026-02-28",
        }),
      })
    );
  });

  it("copies invoice path to clipboard and shows sileo toast when path button is clicked", async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    const copyBtn = screen.getByTestId(`invoice-path-btn-${mockInvoices[0].id}`);
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(mockInvoices[0].path_storage);
    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ruta de archivo copiada al portapapeles",
        description: mockInvoices[0].path_storage,
      })
    );
  });

  it("renders 'Visualizar archivo' column header and eye icon for invoices with path_storage", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    expect(screen.getByText("Visualizar archivo")).toBeInTheDocument();
    expect(screen.getByTestId(`invoice-view-file-btn-${mockInvoices[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`invoice-view-file-btn-${mockInvoices[1].id}`)).toBeInTheDocument();
  });

  it("opens invoice preview modal when clicking the eye icon", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/fac-manual-001.pdf?sig=test",
      path_storage: mockInvoices[0].path_storage,
    });

    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    const eyeBtn = screen.getByTestId(`invoice-view-file-btn-${mockInvoices[0].id}`);
    await user.click(eyeBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Visualización de Factura" })
      ).toBeInTheDocument();
      expect(screen.getByText(/Código \/ Folio: FAC-MANUAL-001/i)).toBeInTheDocument();
    });
  });

  it("opens invoice preview modal from 3-dots action menu", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/fac-manual-001.pdf?sig=test",
      path_storage: mockInvoices[0].path_storage,
    });

    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    const actionsBtn = screen.getByTestId(`invoice-actions-btn-${mockInvoices[0].id}`);
    await user.click(actionsBtn);

    const viewMenuItem = await screen.findByTestId("menu-item-view-invoice-file");
    await user.click(viewMenuItem);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Visualización de Factura" })
      ).toBeInTheDocument();
      expect(screen.getByText(/Código \/ Folio: FAC-MANUAL-001/i)).toBeInTheDocument();
    });
  });
  it("requests subsequent pages when the business has more than 100 invoices", async () => {
    vi.mocked(businessServices.getInvoices).mockImplementation(async (params) => ({ data: [{ ...mockInvoices[0], id: `page-${params?.page ?? 1}`, code: `INVOICE-PAGE-${params?.page ?? 1}` }], meta: { total_items: 151, page: params?.page ?? 1, limit: params?.limit ?? 25, total_pages: 7 } }));
    renderWithClient(<InvoicesTab businessId="biz-123" />);
    expect(await screen.findByText("INVOICE-PAGE-1")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /siguiente|next page/i });
    await waitFor(() => expect(next).toBeEnabled()); await user.click(next);
    expect(await screen.findByText("INVOICE-PAGE-2")).toBeInTheDocument();
    expect(businessServices.getInvoices).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 25 }));
    expect(vi.mocked(businessServices.getInvoices).mock.calls.every(([params]) => params?.all !== true)).toBe(true);
  });
  it("preserves invoices after a failed refetch and recovers with a single error toast", async () => {
    const queryClient = new QueryClient({
      queryCache: new QueryCache({ onError: notifyHttpError }),
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(<QueryClientProvider client={queryClient}><InvoicesTab businessId="biz-123" /></QueryClientProvider>);
    expect(await screen.findByText("FAC-MANUAL-001")).toBeInTheDocument();
    vi.mocked(businessServices.getInvoices).mockRejectedValueOnce(new Error("unavailable"));
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ["invoices", "list"] }); });
    expect(await screen.findByRole("button", { name: /Reintentar/i })).toBeInTheDocument();
    expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /Reintentar/i }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Reintentar/i })).not.toBeInTheDocument());
    expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
  });

  it("queries active records by default and restores that default after clearing filters", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);
    await waitFor(() => expect(businessServices.getInvoices).toHaveBeenCalledWith(expect.objectContaining({ q: expect.objectContaining({ is_active_eq: true }) })));
    await user.click(screen.getByRole("button", { name: /^abrir filtros/i }));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(businessServices.getInvoices).toHaveBeenLastCalledWith(expect.objectContaining({ q: expect.objectContaining({ is_active_eq: true }) }));
  });

  it("shows mobile invoice cards with the same edit target and active predicate", async () => {
    mockMobile();
    renderWithClient(<InvoicesTab businessId="biz-123" />);
    const card = await screen.findByRole("article", { name: "FAC-MANUAL-001" });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: /Acciones de/ }));
    await user.click(screen.getByRole("menuitem", { name: "Actualizar" }));
    expect(await screen.findByDisplayValue("FAC-MANUAL-001")).toBeInTheDocument();
    expect(businessServices.getInvoices).toHaveBeenCalledWith(expect.objectContaining({ page: 1, q: expect.objectContaining({ is_active_eq: true }) }));
  });

  it("transports an optional empty folio as null and preserves an explicit inactive selection on create", async () => {
    renderWithClient(<InvoicesTab businessId={businessId} />);
    const create = screen.getByTestId("new-invoice-btn");
    await waitFor(() => expect(create).toBeEnabled());
    await user.click(create);
    await user.click(screen.getByTestId("invoice-active-switch").querySelector("input")!);
    await user.click(screen.getByTestId("save-invoice-btn"));
    await waitFor(() => expect(cashServices.sendCashMutation).toHaveBeenCalledWith(businessId, expect.any(String),
      expect.objectContaining({ operation: "invoice_create", fields: expect.objectContaining({ code: null, is_active: false }) })));
    await waitFor(() => expect(screen.queryByTestId("invoice-code-input")).not.toBeInTheDocument());
  });

  it("uses the revision shown, preserves the changed amount on explicit rebase, and clears the linked expense", async () => {
    const source = {
      ...mockInvoices[0], id: "17", business_id: businessId, code: "F-17",
      version: 7, cash_expense: { movement_id: movementId, category: linkedCategory },
    };
    vi.mocked(businessServices.getInvoices).mockResolvedValue({
      data: [source], meta: { page: 1, limit: 25, total_pages: 1, total_items: 1 },
    });
    vi.mocked(businessServices.getInvoiceEditSource).mockResolvedValueOnce(source).mockResolvedValueOnce({
      ...source, version: 8, total_amount: 600000, data: { ...source.data, issue_date: "2026-02-20" },
    });
    vi.mocked(cashServices.sendCashMutation)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { message: "business:cash_version_conflict" } },
      })
      .mockResolvedValueOnce(committed("invoice_update"));
    renderWithClient(<InvoicesTab businessId={businessId} />);
    await user.click(await screen.findByTestId("invoice-actions-btn-17"));
    await user.click(await screen.findByTestId("menu-item-edit-invoice"));

    const amount = (await screen.findByTestId("invoice-total-amount-input")).querySelector("input")!;
    await user.clear(amount);
    await user.type(amount, "700000");
    expect(screen.getByText(/El egreso quedará en.*700.000/)).toBeVisible();
    const save = screen.getByTestId("save-invoice-btn");
    await user.click(save);
    expect(cashServices.sendCashMutation).toHaveBeenLastCalledWith(businessId, expect.any(String), {
      operation: "invoice_update", id: "17",
      fields: { expected_version: 7, total_amount: 700000 },
    });

    const review = await screen.findByRole("button", { name: i18n.t("business:cash.review_current") });
    expect(save).toBeDisabled();
    await user.click(review);
    expect(await screen.findByText(i18n.t("business:cash.current_version", { version: 8 }))).toBeVisible();
    await user.click(screen.getByRole("button", { name: i18n.t("business:cash.accept_current") }));
    expect(amount).toHaveValue(700000);
    expect(screen.getByDisplayValue("2026-02-20")).toBeVisible();
    const picker = screen.getByRole("button", { name: i18n.t("business:cash.expense_category") });
    await user.click(within(picker).getByRole("button", { name: i18n.t("core:clear_selection") }));
    expect(screen.getByText(i18n.t("business:cash.invoice_effect_withdraw"))).toBeVisible();
    await user.click(save);
    expect(cashServices.sendCashMutation).toHaveBeenLastCalledWith(businessId, expect.any(String), {
      operation: "invoice_update", id: "17",
      fields: { expected_version: 8, total_amount: 700000, cash_category_id: null },
    });
  });
});
