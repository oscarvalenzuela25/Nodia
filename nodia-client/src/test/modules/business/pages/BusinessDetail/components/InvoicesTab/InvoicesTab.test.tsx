import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import InvoicesTab from "../../../../../../../modules/business/pages/BusinessDetail/components/InvoicesTab/InvoicesTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { InvoiceEntity, ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

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
}));

const mockProviders: ProviderEntity[] = [
  {
    id: "prov-1",
    business_id: "biz-123",
    name: "Distribuidora Mayorista",
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

  it("toggles invoice active status using updateInvoice", async () => {
    vi.mocked(businessServices.updateInvoice).mockResolvedValue({
      ...mockInvoices[0],
      is_active: false,
    });

    renderWithClient(<InvoicesTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("FAC-MANUAL-001")).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId(`toggle-invoice-${mockInvoices[0].id}`);
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(businessServices.updateInvoice).toHaveBeenCalledTimes(1);
    });

    expect(businessServices.updateInvoice).toHaveBeenCalledWith(
      mockInvoices[0].id,
      { is_active: false }
    );
  });
});
