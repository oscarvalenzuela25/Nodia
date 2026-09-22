import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import ProvidersTab from "../../../../../../../modules/business/pages/BusinessDetail/components/ProvidersTab/ProvidersTab";
import * as businessServices from "../../../../../../../modules/business/infrastructure/services";
import type { ProviderEntity } from "../../../../../../../modules/business/infrastructure/types";

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
  getProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
}));

const mockProviders: ProviderEntity[] = [
  {
    id: "prov-101",
    business_id: "biz-123",
    name: "Lácteos del Sur",
    tax: 19,
    fields: {
      code: { value: "COD_PROD", instructions: "Tomar código numérico" },
      cost_price: "VALOR_NETO",
      cost_price_tax: "VALOR_BRUTO",
      packages: { value: "BULTOS", instructions: "Solo números enteros" },
      units_per_package: "UNID_X_CAJA",
    },
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prov-102",
    business_id: "biz-123",
    name: "Envases Modernos",
    tax: 10,
    fields: {},
    is_active: false,
    created_at: "2026-01-01T00:00:00Z",
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

describe("ProvidersTab Component", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(businessServices.getProviders).mockResolvedValue({
      data: mockProviders,
      meta: { total_items: 2, page: 1, limit: 50, total_pages: 1 },
    });
  });

  it("renders table with ID, Name, Tax, Fields, Status, and Actions columns", async () => {
    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Lácteos del Sur")).toBeInTheDocument();
    });

    // Header columns
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nombre de Empresa / Proveedor")).toBeInTheDocument();
    expect(screen.getByText("Impuesto (%)")).toBeInTheDocument();
    expect(screen.getByText("Campos / Información")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();

    // Provider 1: has ID, tax chip, and 5 structured lines
    expect(screen.getByText("prov-101")).toBeInTheDocument();
    expect(screen.getByTestId("provider-tax-chip-prov-101")).toHaveTextContent("19%");
    expect(screen.getByTestId("provider-field-code-prov-101")).toHaveTextContent(
      "Código: COD_PROD"
    );
    expect(
      screen.getByTestId("provider-field-code-prov-101-instructions")
    ).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-cost-price-prov-101")).toHaveTextContent(
      "Costo base sin impuestos: VALOR_NETO"
    );
    expect(screen.getByTestId("provider-field-cost-price-tax-prov-101")).toHaveTextContent(
      "Costo base con impuestos: VALOR_BRUTO"
    );
    expect(screen.getByTestId("provider-field-packages-prov-101")).toHaveTextContent(
      "Cajas / Bultos: BULTOS"
    );
    expect(
      screen.getByTestId("provider-field-packages-prov-101-instructions")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("provider-field-units-per-package-prov-101")
    ).toHaveTextContent("Unidades por caja: UNID_X_CAJA");

    // Provider 2: has tax chip and 'Sin información' in the 5 lines
    expect(screen.getByText("prov-102")).toBeInTheDocument();
    expect(screen.getByTestId("provider-tax-chip-prov-102")).toHaveTextContent("10%");
    expect(screen.getByTestId("provider-field-code-prov-102")).toHaveTextContent(
      "Código: Sin información"
    );
    expect(screen.getByTestId("provider-field-cost-price-prov-102")).toHaveTextContent(
      "Costo base sin impuestos: Sin información"
    );
    expect(screen.getByTestId("provider-field-cost-price-tax-prov-102")).toHaveTextContent(
      "Costo base con impuestos: Sin información"
    );
    expect(screen.getByTestId("provider-field-packages-prov-102")).toHaveTextContent(
      "Cajas / Bultos: Sin información"
    );
    expect(
      screen.getByTestId("provider-field-units-per-package-prov-102")
    ).toHaveTextContent("Unidades por caja: Sin información");
  });

  it("opens 3-dots action menu with Editar and Desactivar options for active provider", async () => {
    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("provider-actions-btn-prov-101")).toBeInTheDocument();
    });

    // Click 3-dots menu for prov-101
    await user.click(screen.getByTestId("provider-actions-btn-prov-101"));

    expect(screen.getByTestId("menu-item-edit-provider")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-toggle-provider")).toHaveTextContent(/desactivar/i);
  });

  it("opens 3-dots action menu with Activar option for inactive provider", async () => {
    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("provider-actions-btn-prov-102")).toBeInTheDocument();
    });

    // Click 3-dots menu for prov-102
    await user.click(screen.getByTestId("provider-actions-btn-prov-102"));

    expect(screen.getByTestId("menu-item-edit-provider")).toBeInTheDocument();
    expect(screen.getByTestId("menu-item-toggle-provider")).toHaveTextContent(/activar/i);
  });

  it("opens confirm dialog when clicking Desactivar and calls updateProvider on confirmation", async () => {
    vi.mocked(businessServices.updateProvider).mockResolvedValueOnce({
      ...mockProviders[0],
      is_active: false,
    });

    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("provider-actions-btn-prov-101")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("provider-actions-btn-prov-101"));
    await user.click(screen.getByTestId("menu-item-toggle-provider"));

    // ConfirmDialog opens
    expect(screen.getByText("¿Desactivar proveedor?")).toBeInTheDocument();

    // Confirm
    const confirmBtn = screen.getByRole("button", { name: /desactivar/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(businessServices.updateProvider).toHaveBeenCalledWith("prov-101", {
        is_active: false,
      });
    });
  });

  it("opens edit modal when clicking Editar in the 3-dots menu", async () => {
    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("provider-actions-btn-prov-101")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("provider-actions-btn-prov-101"));
    await user.click(screen.getByTestId("menu-item-edit-provider"));

    expect(screen.getByText("Editar Proveedor")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lácteos del Sur")).toBeInTheDocument();
    expect(screen.getByDisplayValue("COD_PROD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("VALOR_NETO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("VALOR_BRUTO")).toBeInTheDocument();
  });

  it("paginates providers table with 50 rows per page by default and allows changing page", async () => {
    vi.mocked(businessServices.getProviders).mockResolvedValueOnce({
      data: mockProviders,
      meta: { total_items: 120, page: 1, limit: 50, total_pages: 3 },
    });

    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Lácteos del Sur")).toBeInTheDocument();
    });

    expect(businessServices.getProviders).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      q: {
        business_id_eq: "biz-123",
        name_cont: undefined,
      },
    });

    // Verify pagination controls
    expect(screen.getByText(/1[–-]50\s+(de|of)\s+120/i)).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    // Click next page
    const nextPageBtn = screen.getByRole("button", { name: /siguiente|next/i });
    expect(nextPageBtn).toBeEnabled();

    vi.mocked(businessServices.getProviders).mockResolvedValueOnce({
      data: mockProviders,
      meta: { total_items: 120, page: 2, limit: 50, total_pages: 3 },
    });

    await user.click(nextPageBtn);

    await waitFor(() => {
      expect(businessServices.getProviders).toHaveBeenCalledWith({
        page: 2,
        limit: 50,
        q: {
          business_id_eq: "biz-123",
          name_cont: undefined,
        },
      });
    });
  });
});
