import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProviderModal from "../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderModal/ProviderModal";
import type { ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

describe("ProviderModal Component", () => {
  const user = userEvent.setup();
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders new provider modal with name, invoice mapping inputs, and active switch", () => {
    render(
      <ProviderModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText("Registrar Proveedor")).toBeInTheDocument();
    expect(screen.getByTestId("provider-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-cost-price-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-cost-price-tax-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-active-switch")).toBeInTheDocument();
  });

  it("submits provider with mapped invoice fields and active status", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <ProviderModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    // Enter name
    const nameInput = screen.getByTestId("provider-name-input").querySelector("input")!;
    await user.type(nameInput, "Distribuidora Central");

    // Enter invoice mapping columns
    const codeInput = screen.getByTestId("provider-field-code-input").querySelector("input")!;
    const costPriceInput = screen.getByTestId("provider-field-cost-price-input").querySelector("input")!;
    const costPriceTaxInput = screen.getByTestId("provider-field-cost-price-tax-input").querySelector("input")!;

    await user.type(codeInput, "COD_ARTICULO");
    await user.type(costPriceInput, "PRECIO_NETO");
    await user.type(costPriceTaxInput, "PRECIO_BRUTO");

    // Submit
    await user.click(screen.getByTestId("save-provider-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "Distribuidora Central",
      fields: {
        code: "COD_ARTICULO",
        cost_price: "PRECIO_NETO",
        cost_price_tax: "PRECIO_BRUTO",
      },
      is_active: true,
    });
  });

  it("submits provider without mapping fields when left empty", async () => {
    mockOnSubmit.mockResolvedValueOnce(undefined);

    render(
      <ProviderModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const nameInput = screen.getByTestId("provider-name-input").querySelector("input")!;
    await user.type(nameInput, "Proveedor Sin Mapeo");

    await user.click(screen.getByTestId("save-provider-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "Proveedor Sin Mapeo",
      fields: {},
      is_active: true,
    });
  });

  it("pre-fills existing provider mapping data in edit mode", async () => {
    const existingProvider: ProviderEntity = {
      id: "prov-99",
      business_id: "biz-123",
      name: "Comercializadora del Sur",
      fields: {
        code: "SKU_PROD",
        cost_price: "VALOR_NETO",
        cost_price_tax: "TOTAL_CON_IVA",
      },
      is_active: false,
      created_at: "2026-01-01T00:00:00Z",
    };

    render(
      <ProviderModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        initialData={existingProvider}
      />
    );

    expect(screen.getByText("Editar Proveedor")).toBeInTheDocument();

    const nameInput = screen.getByTestId("provider-name-input").querySelector("input")!;
    expect(nameInput).toHaveValue("Comercializadora del Sur");

    expect(
      screen.getByTestId("provider-field-code-input").querySelector("input")
    ).toHaveValue("SKU_PROD");
    expect(
      screen.getByTestId("provider-field-cost-price-input").querySelector("input")
    ).toHaveValue("VALOR_NETO");
    expect(
      screen.getByTestId("provider-field-cost-price-tax-input").querySelector("input")
    ).toHaveValue("TOTAL_CON_IVA");

    // Switch should be unchecked
    const switchInput = screen.getByTestId("provider-active-switch").querySelector("input")!;
    expect(switchInput).not.toBeChecked();
  });
});
