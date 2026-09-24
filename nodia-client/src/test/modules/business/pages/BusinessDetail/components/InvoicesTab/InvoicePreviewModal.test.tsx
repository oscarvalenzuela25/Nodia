import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import InvoicePreviewModal from "../../../../../../../modules/business/pages/BusinessDetail/components/InvoicesTab/components/InvoicePreviewModal/InvoicePreviewModal";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { InvoiceEntity } from "../../../../../../../modules/business/infrastructure/types";
import { sileo } from "sileo";

vi.mock("sileo", () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../../../../../modules/business/infrastructure/services", () => ({
  getInvoiceViewUrl: vi.fn(),
}));

const mockInvoiceImage: InvoiceEntity = {
  id: "inv-img-1",
  business_id: "biz-123",
  code: "FAC-IMAGE-001",
  total_amount: 350000,
  path_storage: "invoices/biz-123/receipt.png",
  data: {
    issue_date: "2026-03-01",
    notes: "Factura en imagen",
  },
  is_active: true,
  created_at: "2026-03-01T10:00:00Z",
};

const mockInvoicePdf: InvoiceEntity = {
  id: "inv-pdf-2",
  business_id: "biz-123",
  code: "FAC-PDF-002",
  total_amount: 850000,
  path_storage: "invoices/biz-123/document.pdf",
  data: {
    issue_date: "2026-03-02",
    notes: "Factura en PDF",
  },
  is_active: true,
  created_at: "2026-03-02T10:00:00Z",
};

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

describe("InvoicePreviewModal Component", () => {
  const user = userEvent.setup();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders image preview when invoice is an image", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc",
      path_storage: "invoices/biz-123/receipt.png",
    });

    renderWithClient(
      <InvoicePreviewModal
        open={true}
        onClose={mockOnClose}
        invoice={mockInvoiceImage}
      />
    );

    expect(screen.getByText(/Visualización de Factura: FAC-IMAGE-001/i)).toBeInTheDocument();
    expect(screen.getByText("receipt.png")).toBeInTheDocument();

    await waitFor(() => {
      const img = screen.getByTestId("preview-image");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute(
        "src",
        "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc"
      );
    });

    expect(screen.getByTestId("preview-open-new-tab-btn")).toBeInTheDocument();
  });

  it("renders iframe preview when invoice is a PDF", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/biz-123/document.pdf?sig=xyz",
      path_storage: "invoices/biz-123/document.pdf",
    });

    renderWithClient(
      <InvoicePreviewModal
        open={true}
        onClose={mockOnClose}
        invoice={mockInvoicePdf}
      />
    );

    await waitFor(() => {
      const iframe = screen.getByTestId("preview-iframe");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute(
        "src",
        "https://r2.storage.nodia.app/invoices/biz-123/document.pdf?sig=xyz"
      );
    });
  });

  it("shows error alert and allows retrying when fetch fails", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockRejectedValueOnce(
      new Error("Failed to load")
    );

    renderWithClient(
      <InvoicePreviewModal
        open={true}
        onClose={mockOnClose}
        invoice={mockInvoiceImage}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("No se pudo cargar la vista previa del archivo")
      ).toBeInTheDocument();
    });

    // Provide successful response for retry
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc",
      path_storage: "invoices/biz-123/receipt.png",
    });

    const retryBtn = screen.getByRole("button", { name: /reintentar/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("preview-image")).toBeInTheDocument();
    });
  });

  it("copies path to clipboard and calls sileo.success", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc",
      path_storage: "invoices/biz-123/receipt.png",
    });

    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    renderWithClient(
      <InvoicePreviewModal
        open={true}
        onClose={mockOnClose}
        invoice={mockInvoiceImage}
      />
    );

    const copyBtn = screen.getByTestId("preview-copy-path-btn");
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith("invoices/biz-123/receipt.png");
    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ruta de archivo copiada al portapapeles",
        description: "invoices/biz-123/receipt.png",
      })
    );
  });

  it("opens URL in new tab when clicking open in new tab button", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc",
      path_storage: "invoices/biz-123/receipt.png",
    });

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderWithClient(
      <InvoicePreviewModal
        open={true}
        onClose={mockOnClose}
        invoice={mockInvoiceImage}
      />
    );

    const openBtn = await screen.findByTestId("preview-open-new-tab-btn");
    await user.click(openBtn);

    expect(openSpy).toHaveBeenCalledWith(
      "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("shows image error alert when image fails to load (e.g. empty 0-byte file)", async () => {
    vi.mocked(businessServices.getInvoiceViewUrl).mockResolvedValueOnce({
      url: "https://r2.storage.nodia.app/invoices/biz-123/receipt.png?sig=abc",
      path_storage: "invoices/biz-123/receipt.png",
    });

    renderWithClient(
      <InvoicePreviewModal
        open={true}
        onClose={mockOnClose}
        invoice={mockInvoiceImage}
      />
    );

    const img = await screen.findByTestId("preview-image");
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByTestId("preview-image-error")).toBeInTheDocument();
      expect(
        screen.getByText("No se pudo visualizar la imagen")
      ).toBeInTheDocument();
    });
  });
});
