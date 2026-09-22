import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductModal from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductModal";
import type { ProductEntity, ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

describe("ProductModal Component", () => {
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

  it("renders new product modal with all standard inputs and active switch", () => {
    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    expect(screen.getByText("Crear Producto")).toBeInTheDocument();
    expect(screen.getByTestId("product-active-switch")).toBeInTheDocument();
    expect(screen.getByTestId("product-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-cost-price-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-tax-rate-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-cost-tax-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-profit-margin-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-sale-price-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-stock-input")).toBeInTheDocument();
    expect(screen.getByTestId("product-provider-select")).toBeInTheDocument();
    expect(screen.getByTestId("save-product-btn")).toBeInTheDocument();
  });

  it("submits product with filled data", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    const codeInput = screen.getByTestId("product-code-input").querySelector("input")!;
    const nameInput = screen.getByTestId("product-name-input").querySelector("input")!;
    const costInput = screen.getByTestId("product-cost-price-input").querySelector("input")!;
    const salePriceInput = screen.getByTestId("product-sale-price-input").querySelector("input")!;
    const stockInput = screen.getByTestId("product-stock-input").querySelector("input")!;

    await user.type(codeInput, "SKU-9900");
    await user.type(nameInput, "Monitor LED 27");
    await user.clear(costInput);
    await user.type(costInput, "100000");
    await user.clear(salePriceInput);
    await user.type(salePriceInput, "150000");
    await user.clear(stockInput);
    await user.type(stockInput, "12");

    await user.click(screen.getByTestId("save-product-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SKU-9900",
        name: "Monitor LED 27",
        cost_price: 100000,
        sale_price: 150000,
        stock: 12,
        is_active: true,
      })
    );
  });

  it("pre-fills existing product data in edit mode", async () => {
    const existingProduct: ProductEntity = {
      id: "prod-1",
      business_id: "biz-123",
      code: "SKU-EDIT-1",
      name: "Mouse Inalámbrico",
      cost_price: 15000,
      cost_price_tax: 2850,
      profit_percentage: 40,
      sale_price: 25000,
      stock: 50,
      provider_id: "prov-1",
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
    };

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={existingProduct}
        providers={mockProviders}
      />
    );

    expect(screen.getByText("Editar Producto")).toBeInTheDocument();
    expect(screen.getByTestId("product-code-input").querySelector("input")).toHaveValue("SKU-EDIT-1");
    expect(screen.getByTestId("product-name-input").querySelector("input")).toHaveValue("Mouse Inalámbrico");
    expect(screen.getByTestId("product-active-switch").querySelector("input")).not.toBeChecked();
  });

  it("interconnects financial fields bidirectionally", async () => {
    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    const costInput = screen.getByTestId("product-cost-price-input").querySelector("input")!;
    const taxRateInput = screen.getByTestId("product-tax-rate-input").querySelector("input")!;
    const costTaxInput = screen.getByTestId("product-cost-tax-input").querySelector("input")!;
    const salePriceInput = screen.getByTestId("product-sale-price-input").querySelector("input")!;

    // Initial tax rate is 19
    expect(taxRateInput).toHaveValue(19);

    // 1. Entering cost_price calculates cost_price_tax (100000 * 1.19 = 119000) and sale_price (119000 * 1.30 = 154700)
    await user.clear(costInput);
    await user.type(costInput, "100000");

    expect(costTaxInput).toHaveValue(119000);
    expect(salePriceInput).toHaveValue(154700);

    // 2. Changing tax rate to 10 recalculates cost_price_tax (100000 * 1.10 = 110000) and sale_price (110000 * 1.30 = 143000)
    await user.clear(taxRateInput);
    await user.type(taxRateInput, "10");

    expect(costTaxInput).toHaveValue(110000);
    expect(salePriceInput).toHaveValue(143000);
  });

  it("allows submitting product with stock = 0", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <ProductModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        providers={mockProviders}
      />
    );

    const codeInput = screen.getByTestId("product-code-input").querySelector("input")!;
    const nameInput = screen.getByTestId("product-name-input").querySelector("input")!;
    const costInput = screen.getByTestId("product-cost-price-input").querySelector("input")!;
    const salePriceInput = screen.getByTestId("product-sale-price-input").querySelector("input")!;
    const stockInput = screen.getByTestId("product-stock-input").querySelector("input")!;

    await user.type(codeInput, "SKU-ZERO-STOCK");
    await user.type(nameInput, "Servicio Digital");
    await user.clear(costInput);
    await user.type(costInput, "5000");
    await user.clear(salePriceInput);
    await user.type(salePriceInput, "8000");

    // Stock starts at 0 by default, ensure it remains 0
    expect(stockInput).toHaveValue(0);

    await user.click(screen.getByTestId("save-product-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "SKU-ZERO-STOCK",
        name: "Servicio Digital",
        cost_price: 5000,
        sale_price: 8000,
        stock: 0,
      })
    );
  });
});
