import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProviderModal from "../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/components/ProviderModal/ProviderModal";
import type { ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

describe("ProviderModal Component", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
  });

  it("renders new provider modal with name, tax, 5 invoice mapping inputs, and active switch at bottom", () => {
    render(
      <ProviderModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText("Registrar Proveedor")).toBeInTheDocument();
    expect(screen.getByTestId("provider-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-tax-input")).toBeInTheDocument();
    expect(
      screen.getByTestId("provider-tax-input").querySelector("input")
    ).toHaveValue(19);

    // The 5 invoice mapping fields
    expect(screen.getByTestId("provider-field-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-cost-price-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-cost-price-tax-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-packages-input")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-units-per-package-input")).toBeInTheDocument();

    // Instructions inputs are initially hidden (progressive disclosure)
    expect(screen.queryByTestId("provider-field-code-instructions-input")).not.toBeInTheDocument();

    // Switch is at bottom
    expect(screen.getByTestId("provider-active-switch")).toBeInTheDocument();
  });

  it("progressively discloses instructions input when primary column input is typed into", async () => {
    render(
      <ProviderModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    );

    const codeInput = screen.getByTestId("provider-field-code-input").querySelector("input")!;
    expect(screen.queryByTestId("provider-field-code-instructions-input")).not.toBeInTheDocument();

    await user.type(codeInput, "CODIGO");

    await waitFor(() => {
      expect(screen.getByTestId("provider-field-code-instructions-input")).toBeInTheDocument();
    });
  });

  it("submits provider with mapped invoice fields including instructions, tax, and active status", async () => {
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
    await user.type(codeInput, "COD_ARTICULO");

    // Enter instructions for code
    await waitFor(() => {
      expect(screen.getByTestId("provider-field-code-instructions-input")).toBeInTheDocument();
    });
    const codeInstructionsInput = screen
      .getByTestId("provider-field-code-instructions-input")
      .querySelector("textarea, input")!;
    await user.type(codeInstructionsInput, "Tomar el valor de la izquierda");

    // Enter packages column
    const packagesInput = screen.getByTestId("provider-field-packages-input").querySelector("input")!;
    await user.type(packagesInput, "CAJAS");

    // Submit
    await user.click(screen.getByTestId("save-provider-btn"));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      name: "Distribuidora Central",
      tax: 19,
      fields: {
        code: {
          value: "COD_ARTICULO",
          instructions: "Tomar el valor de la izquierda",
        },
        packages: {
          value: "CAJAS",
          instructions: "",
        },
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
      tax: 19,
      fields: {},
      is_active: true,
    });
  });

  it("pre-fills existing provider mapping data (supporting both legacy string and new object) and tax in edit mode", async () => {
    const existingProvider: ProviderEntity = {
      id: "prov-99",
      business_id: "biz-123",
      name: "Comercializadora del Sur",
      tax: 10,
      fields: {
        code: {
          value: "SKU_PROD",
          instructions: "El SKU está al inicio",
        },
        cost_price: "VALOR_NETO",
        packages: {
          value: "BULTOS",
          instructions: "",
        },
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
      screen.getByTestId("provider-tax-input").querySelector("input")
    ).toHaveValue(10);

    expect(
      screen.getByTestId("provider-field-code-input").querySelector("input")
    ).toHaveValue("SKU_PROD");
    expect(
      screen.getByTestId("provider-field-code-instructions-input").querySelector("textarea, input")
    ).toHaveValue("El SKU está al inicio");

    expect(
      screen.getByTestId("provider-field-cost-price-input").querySelector("input")
    ).toHaveValue("VALOR_NETO");

    expect(
      screen.getByTestId("provider-field-packages-input").querySelector("input")
    ).toHaveValue("BULTOS");

    // Switch should be unchecked
    const switchInput = screen.getByTestId("provider-active-switch").querySelector("input")!;
    expect(switchInput).not.toBeChecked();
  });
});
