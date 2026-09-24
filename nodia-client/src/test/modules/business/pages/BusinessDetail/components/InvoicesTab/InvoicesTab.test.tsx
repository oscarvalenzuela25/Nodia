import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import InvoicesTab from "../../../../../../../modules/business/pages/BusinessDetail/components/InvoicesTab/InvoicesTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { InvoiceEntity, ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";
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
  getInvoices: vi.fn(),
  createInvoice: vi.fn(),
  createInvoiceWithFile: vi.fn(),
  updateInvoice: vi.fn(),
  getProviders: vi.fn(),
  getInvoiceViewUrl: vi.fn(),
}));

const mockProviders: ProviderEntity[] = [
  {
    id: "prov-1",
    business_id: "biz-123",
    name: "Distribuidora Mayorista",
    tax: 19,
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

describe("InvoicesTab Component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("opens modal and allows registering an invoice manually with an uploaded file without analyze", async () => {
    vi.mocked(businessServices.createInvoiceWithFile).mockResolvedValue({
      id: "inv-new",
      business_id: "biz-123",
      code: "FAC-NUEVA-777",
      total_amount: 300000,
      path_storage: "invoices/fac-nueva.pdf",
      is_active: true,
      created_at: "2026-03-20T00:00:00Z",
    });

    renderWithClient(<InvoicesTab businessId="biz-123" />);

    // Click "Registrar Factura" button
    const newInvoiceBtn = screen.getByTestId("new-invoice-btn");
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

    // Click save
    const saveBtn = screen.getByTestId("save-invoice-btn");
    await user.click(saveBtn);

    await waitFor(() => {
      expect(businessServices.createInvoiceWithFile).toHaveBeenCalledTimes(1);
    });

    expect(businessServices.createInvoiceWithFile).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: "biz-123",
        code: "FAC-NUEVA-777",
        total_amount: 300000,
        file,
      })
    );
  });

  it("renders table without status column", async () => {
    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    // Verify invoice_status column is not rendered in headers
    expect(screen.queryByRole("columnheader", { name: "Estado" })).not.toBeInTheDocument();
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
    await waitFor(() => {
      expect(screen.getByText("Editar Factura")).toBeInTheDocument();
    });
    expect(screen.getByTestId("invoice-code-input").querySelector("input")).toHaveValue("FAC-MANUAL-001");
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
    const filterBtn = screen.getByRole("button", { name: /abrir filtros|filtro/i });
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
        screen.getByText(/Visualización de Factura: FAC-MANUAL-001/i)
      ).toBeInTheDocument();
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
        screen.getByText(/Visualización de Factura: FAC-MANUAL-001/i)
      ).toBeInTheDocument();
    });
  });
});
