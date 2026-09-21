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
    fields: {
      code: "COD_PROD",
      cost_price: "VALOR_NETO",
      cost_price_tax: "VALOR_BRUTO",
    },
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "prov-102",
    business_id: "biz-123",
    name: "Envases Modernos",
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
      meta: { total_items: 2, page: 1, limit: 100, total_pages: 1 },
    });
  });

  it("renders table with ID, Name, Fields, Status, and Actions columns", async () => {
    renderWithClient(<ProvidersTab businessId="biz-123" />);

    await waitFor(() => {
      expect(screen.getByText("Lácteos del Sur")).toBeInTheDocument();
    });

    // Header columns
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Nombre de Empresa / Proveedor")).toBeInTheDocument();
    expect(screen.getByText("Campos / Información")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();

    // Provider 1: has ID and dynamic chips for fields
    expect(screen.getByText("prov-101")).toBeInTheDocument();
    expect(screen.getByTestId("provider-field-chip-prov-101-code")).toHaveTextContent(
      "code: COD_PROD"
    );
    expect(screen.getByTestId("provider-field-chip-prov-101-cost_price")).toHaveTextContent(
      "cost_price: VALOR_NETO"
    );
    expect(screen.getByTestId("provider-field-chip-prov-101-cost_price_tax")).toHaveTextContent(
      "cost_price_tax: VALOR_BRUTO"
    );

    // Provider 2: has no fields -> displays 'Sin campos definidos'
    expect(screen.getByText("prov-102")).toBeInTheDocument();
    expect(screen.getByTestId("no-fields-prov-102")).toHaveTextContent("Sin campos definidos");
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
});
