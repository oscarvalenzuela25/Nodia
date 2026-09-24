import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InvoiceModal from "../../../../../../../modules/business/pages/BusinessDetail/components/InvoicesTab/components/InvoiceModal/InvoiceModal";
import type { InvoiceEntity, ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

describe("InvoiceModal Component", () => {
  const user = userEvent.setup();
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders new invoice modal with all standard inputs, dropzone, and active switch", () => {
    render(
      <InvoiceModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    expect(screen.getByText("Registrar Nueva Factura")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-active-switch")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-dropzone")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-file-input")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-provider-select")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-total-amount-input")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-status-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("invoice-issue-date-input")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-due-date-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("invoice-path-input")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-notes-input")).toBeInTheDocument();
    expect(screen.getByTestId("save-invoice-btn")).toBeInTheDocument();
  });

  it("submits invoice with filled data", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <InvoiceModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    const codeInput = screen.getByTestId("invoice-code-input").querySelector("input")!;
    const amountInput = screen.getByTestId("invoice-total-amount-input").querySelector("input")!;
    const pathInput = screen.getByTestId("invoice-path-input").querySelector("input")!;

    await user.type(codeInput, "FAC-2026-888");
    await user.clear(amountInput);
    await user.type(amountInput, "450000");
    await user.type(pathInput, "https://storage.nodia.app/invoices/fac-2026-888.pdf");

    await user.click(screen.getByTestId("save-invoice-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FAC-2026-888",
        total_amount: 450000,
        path_storage: "https://storage.nodia.app/invoices/fac-2026-888.pdf",
        is_active: true,
      })
    );
  });

  it("allows uploading an invoice file and submits it alongside form data without analyze", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <InvoiceModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    // Upload an invoice file
    const file = new File(["dummy invoice content"], "factura-proveedor-001.pdf", {
      type: "application/pdf",
    });
    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;
    await user.upload(fileInput, file);

    // Card with selected file name should appear
    expect(screen.getByTestId("invoice-file-selected")).toBeInTheDocument();
    expect(screen.getByText("factura-proveedor-001.pdf")).toBeInTheDocument();

    // Fill form fields manually
    const codeInput = screen.getByTestId("invoice-code-input").querySelector("input")!;
    const amountInput = screen.getByTestId("invoice-total-amount-input").querySelector("input")!;
    await user.type(codeInput, "FAC-PDF-101");
    await user.clear(amountInput);
    await user.type(amountInput, "320000");

    await user.click(screen.getByTestId("save-invoice-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FAC-PDF-101",
        total_amount: 320000,
        file,
        is_active: true,
      })
    );
  });

  it("allows removing the selected file before submitting", async () => {
    render(
      <InvoiceModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    const file = new File(["dummy invoice"], "factura.png", { type: "image/png" });
    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;
    await user.upload(fileInput, file);

    expect(screen.getByTestId("invoice-file-selected")).toBeInTheDocument();

    // Click remove
    const removeBtn = screen.getByTestId("remove-invoice-file");
    await user.click(removeBtn);

    // Dropzone returns
    expect(screen.queryByTestId("invoice-file-selected")).not.toBeInTheDocument();
    expect(screen.getByTestId("invoice-dropzone")).toBeInTheDocument();
  });

  it("pre-fills existing invoice data in edit mode including existing file path", async () => {
    const existingInvoice: InvoiceEntity = {
      id: "inv-1",
      business_id: "biz-123",
      code: "FAC-EXISTING-99",
      provider_id: "prov-1",
      total_amount: 180000,
      path_storage: "invoices/fac-existing.pdf",
      is_active: false,
      data: {
        status: "pending",
        issue_date: "2026-03-15",
        notes: "Pendiente de pago transferencia",
      },
      created_at: "2026-01-01T00:00:00Z",
    };

    render(
      <InvoiceModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={existingInvoice}
        providers={mockProviders}
      />
    );

    expect(screen.getByText("Editar Factura")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-code-input").querySelector("input")).toHaveValue("FAC-EXISTING-99");
    expect(screen.getByTestId("invoice-active-switch").querySelector("input")).not.toBeChecked();
    expect(screen.getByTestId("invoice-existing-file")).toBeInTheDocument();
    expect(screen.getByText("fac-existing.pdf")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-notes-input").querySelector("textarea")).toHaveValue("Pendiente de pago transferencia");
  });

  it("renders image preview inside dropzone and overwrites when uploading another file", async () => {
    render(
      <InvoiceModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    const fileInput = screen.getByTestId("invoice-file-input") as HTMLInputElement;

    // 1. Upload image
    const imgFile = new File(["fake image"], "boleta.jpg", { type: "image/jpeg" });
    await user.upload(fileInput, imgFile);

    expect(screen.getByRole("img", { name: "boleta.jpg" })).toBeInTheDocument();
    expect(screen.getByText("boleta.jpg")).toBeInTheDocument();

    // 2. Upload PDF directly overwriting image
    const pdfFile = new File(["fake pdf"], "boleta_final.pdf", { type: "application/pdf" });
    await user.upload(fileInput, pdfFile);

    expect(screen.queryByRole("img", { name: "boleta.jpg" })).not.toBeInTheDocument();
    expect(screen.getByText("boleta_final.pdf")).toBeInTheDocument();
  });
});
