import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import type { ReactElement } from "react";
import BusinessDetail from "../../../../../modules/business/pages/BusinessDetail/BusinessDetail";
import * as businessServices from "../../../../../modules/business/infrastructure/services";
import type { BusinessEntity } from "../../../../../modules/business/infrastructure/types";
import useAuthStore from "../../../../../store/authStore";
import i18n from "../../../../../translate";

vi.mock("../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace", () => ({
  default: ({ businessId }: { businessId: string }) => <input aria-label={`Carrito sintético ${businessId}`} defaultValue="" />,
}));

vi.mock("../../../../../modules/business/pages/BusinessDetail/components/CashTab", () => ({
  default: ({ onEditInvoice }: { onEditInvoice: (id: string) => void }) => (
    <button onClick={() => onEditInvoice("831")}>Abrir factura vinculada</button>
  ),
}));

vi.mock("sileo", () => ({
  sileo: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../../hooks/useAuth", () => ({
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

vi.mock("../../../../../modules/business/infrastructure/services", () => ({
  getBusinessById: vi.fn(),
  updateBusiness: vi.fn(),
  assignCollaborators: vi.fn(),
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  bulkCreateProducts: vi.fn(),
  bulkUpdateProducts: vi.fn(),
  getProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  getInvoices: vi.fn(),
  getInvoiceEditSource: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
}));

const mockBusiness: BusinessEntity = {
  id: "biz-123",
  name: "Panadería Central",
  owner_id: "42",
  has_description: true,
  is_active: true,
  collaborators_count: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  owner: {
    id: "42",
    name: "Oscar Valenzuela",
    email: "oscar@example.com",
  },
  collaborators: [
    {
      id: "collab-1",
      user_id: "user-99",
      position: "Jefe de Compras",
      action_ids: ["act-1"],
      is_active: true,
      user: {
        id: "user-99",
        name: "Carlos Sanchez",
        email: "carlos@example.com",
      },
    },
  ],
  translates: [
    {
      key: "description",
      es: "Panadería artesanal con productos horneados a diario",
      en: "Artisanal bakery with daily baked goods",
    },
  ],
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

const renderWithClient = (ui: ReactElement, initialEntry = "/business/biz-123") => {
  const queryClient = createTestQueryClient();
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route path="/business/:id" element={ui} />
          <Route path="/business" element={<div>Business List Page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe("BusinessDetail Page", () => {
  beforeEach(() => {
    useAuthStore.getState().login({
      token: "test-jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test user" },
    });
    vi.clearAllMocks();
    vi.mocked(businessServices.getBusinessById).mockResolvedValue(mockBusiness);
    vi.mocked(businessServices.getProducts).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 1 },
    });
    vi.mocked(businessServices.getProviders).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 1 },
    });
    vi.mocked(businessServices.getInvoices).mockResolvedValue({
      data: [],
      meta: { total_items: 0, page: 1, limit: 10, total_pages: 1 },
    });
  });

  it("opens the source invoice by ID from Caja with editable financial fields", async () => {
    vi.mocked(businessServices.getInvoiceEditSource).mockResolvedValue({
      id: "831", business_id: mockBusiness.id, provider_id: null, code: "F-831",
      total_amount: 1200, path_storage: "", data: { issue_date: "2026-11-17" }, is_active: true,
      version: 4,
      cash_expense: {
        movement_id: "3d20c3e7-650c-49f8-a84c-e98c18ec9ee0",
        category: { id: "81", name: "Insumos", is_active: false },
      },
    });
    renderWithClient(<BusinessDetail />, "/business/biz-123?section=cash");
    const opener = await screen.findByRole("button", { name: "Abrir factura vinculada" });
    await userEvent.click(opener);
    const code = await screen.findByTestId("invoice-code-input");
    expect(code.querySelector("input") ?? code).toHaveValue("F-831");
    expect(businessServices.getInvoiceEditSource).toHaveBeenCalledWith("biz-123", "831", expect.any(AbortSignal));
    const amount = screen.getByTestId("invoice-total-amount-input");
    const date = screen.getByTestId("invoice-issue-date-input");
    expect(amount.querySelector("input") ?? amount).toBeEnabled();
    expect(date.querySelector("input") ?? date).toBeEnabled();
    expect(screen.getByText(i18n.t("business:cash.category_inactive_option", { name: "Insumos" }))).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: i18n.t("core:close") }));
    expect(await screen.findByRole("button", { name: "Abrir factura vinculada" })).toBeVisible();
  });

  it("shows the business title and toggles its details from the main navigation row", async () => {
    renderWithClient(<BusinessDetail />);

    const title = await screen.findByRole("heading", { level: 1, name: "Panadería Central" });
    expect(title).toBeVisible();
    expect(screen.queryByRole("link", { name: i18n.t("business:title") })).not.toBeInTheDocument();

    const expand = screen.getByRole("button", { name: i18n.t("business:detail_header_expand") });
    const sectionTabs = screen.getByRole("tablist", { name: i18n.t("business:pos.section") });
    const tabs = within(sectionTabs).getAllByRole("tab");
    expect(tabs.at(-1)).toHaveAccessibleName(/Colaboradores/i);
    expect(sectionTabs).not.toContainElement(expand);
    expect(sectionTabs.compareDocumentPosition(expand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(expand);
    expect(title).toBeVisible();

    // Owner and badge
    expect(screen.getByText(/Oscar Valenzuela/i)).toBeInTheDocument();

    // Description
    expect(
      screen.getByText("Panadería artesanal con productos horneados a diario")
    ).toBeInTheDocument();

    // Action buttons in header
    expect(
      screen.getByRole("button", { name: "Actualizar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Agregar colaborador/i })
    ).toBeInTheDocument();

    // Default tab: Resumen general KPIs
    await waitFor(() => {
      expect(screen.getByText(/Catálogo de Productos/i)).toBeInTheDocument();
      expect(screen.getByText(/Proveedores Registrados/i)).toBeInTheDocument();
      expect(screen.getByText(/Rendimiento Comercial/i)).toBeInTheDocument();
    });
  });

  it("can return to the business list when loading the business fails", async () => {
    vi.mocked(businessServices.getBusinessById).mockRejectedValue(new Error("Business unavailable"));
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    expect(await screen.findByRole("alert")).toBeVisible();
    await user.click(screen.getByRole("button", { name: i18n.t("business:back_to_list") }));

    expect(screen.getByText("Business List Page")).toBeInTheDocument();
  });

  it("opens edit modal when clicking 'Actualizar'", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getByRole("button", { name: i18n.t("business:detail_header_expand") }));
    const editBtn = screen.getByRole("button", { name: "Actualizar" });
    await user.click(editBtn);

    expect(
      screen.getByRole("heading", { name: "Actualizar Negocio" })
    ).toBeInTheDocument();
  });

  it("opens collaborator modal when clicking 'Agregar colaborador'", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getByRole("button", { name: i18n.t("business:detail_header_expand") }));
    const addCollabBtn = screen.getByRole("button", {
      name: /Agregar colaborador/i,
    });
    await user.click(addCollabBtn);

    expect(
      screen.getByText("Asignación de Colaboradores")
    ).toBeInTheDocument();
  });

  it("groups Proveedores, Productos, Facturas and Listas in Market", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />);

    await waitFor(() => {
      expect(screen.getAllByText("Panadería Central").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.queryByRole("tab", { name: /Proveedores/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Facturas/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Market" }));
    const market = within(screen.getByRole("tablist", { name: "Market" }));
    const products = market.getByRole("tab", { name: /Productos/i });
    expect(market.getAllByRole("tab").map((tab) => tab.getAttribute("data-testid"))).toEqual([
      "tab-providers", "tab-products", "tab-invoices", "tab-lists",
    ]);
    expect(products).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByRole("button", { name: /Administrar productos/i })
    ).toBeInTheDocument();

    await user.click(market.getByRole("tab", { name: /Proveedores/i }));
    expect(
      await screen.findByRole("button", { name: /Administrar proveedores/i })
    ).toBeInTheDocument();

    await user.click(market.getByRole("tab", { name: /^Facturas \d+$/i }));
    expect(
      await screen.findByRole("button", { name: /Registrar Factura/i })
    ).toBeInTheDocument();

    const collaboratorsTab = screen.getByRole("tab", { name: /Colaboradores/i });
    await user.click(collaboratorsTab);

    expect(await screen.findByText("Carlos Sanchez")).toBeInTheDocument();
    expect(screen.getByText("Jefe de Compras")).toBeInTheDocument();
  });

  it("opens the existing invoice deep link with Market and Facturas selected", async () => {
    renderWithClient(<BusinessDetail />, "/business/biz-123?section=invoices");
    expect(await screen.findByRole("button", { name: /Registrar Factura/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Market" })).toHaveAttribute("aria-selected", "true");
    const market = within(screen.getByRole("tablist", { name: "Market" }));
    expect(market.getByRole("tab", { name: /^Facturas \d+$/i })).toHaveAttribute("aria-selected", "true");
  });
  it("prevents collaborators from editing the business or assigning collaborators", async () => {
    vi.mocked(businessServices.getBusinessById).mockResolvedValue({ ...mockBusiness, owner_id: "another-user", user_role: "collaborator" });
    renderWithClient(<BusinessDetail />);
    await userEvent.click(await screen.findByRole("button", { name: i18n.t("business:detail_header_expand") }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Actualizar" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Agregar colaborador" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("collapses only the business header while keeping the selected POS and its mounted draft unchanged", async () => {
    const user = userEvent.setup();
    renderWithClient(<BusinessDetail />, "/business/biz-123?section=pos");
    const collapseLabel = i18n.t("business:detail_header_collapse");
    const expandLabel = i18n.t("business:detail_header_expand");
    const toggle = await screen.findByRole("button", { name: expandLabel });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-label", collapseLabel);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const headerId = toggle.getAttribute("aria-controls");
    expect(headerId).toBeTruthy();
    const header = document.getElementById(headerId!);
    expect(header).toBeVisible();
    const cart = screen.getByRole("textbox", { name: "Carrito sintético biz-123" });
    const pos = screen.getByRole("tab", { name: i18n.t("business:pos.title") });
    await user.type(cart, "Producto sintético ×2");
    const businessReads = vi.mocked(businessServices.getBusinessById).mock.calls.length;
    const invoiceReads = vi.mocked(businessServices.getInvoices).mock.calls.length;

    await user.click(toggle);
    const expand = screen.getByRole("button", { name: expandLabel });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute("aria-controls", headerId);
    expect(expand).toHaveFocus();
    await waitFor(() => expect(header).not.toBeVisible());
    expect(pos).toBeVisible();
    expect(pos).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: "Carrito sintético biz-123" })).toBe(cart);
    expect(cart).toHaveValue("Producto sintético ×2");
    await user.hover(expand);
    expect(await screen.findByRole("tooltip", { name: expandLabel })).toBeInTheDocument();
    await user.click(expand);
    await waitFor(() => expect(header).toBeVisible());
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Carrito sintético biz-123" })).toBe(cart);
    expect(cart).toHaveValue("Producto sintético ×2");
    expect(businessServices.getBusinessById).toHaveBeenCalledTimes(businessReads);
    expect(businessServices.getInvoices).toHaveBeenCalledTimes(invoiceReads);
    expect(businessServices.createProduct).not.toHaveBeenCalled();
    expect(businessServices.updateProduct).not.toHaveBeenCalled();
  });

  it("isolates header collapse by business while keeping navigation available", async () => {
    vi.mocked(businessServices.getBusinessById).mockImplementation(async id => id === "biz-456"
      ? { ...mockBusiness, id: "biz-456", name: "Otro negocio sintético" }
      : mockBusiness);
    const user = userEvent.setup();
    renderWithClient(<><BusinessDetail />
      <Link to="/business/biz-456?section=pos">Cambiar de negocio</Link>
      <Link to="/business/biz-123?section=pos">Volver al negocio inicial</Link>
    </>, "/business/biz-123?section=pos");
    const collapseLabel = i18n.t("business:detail_header_collapse");
    const expandLabel = i18n.t("business:detail_header_expand");
    const toggle = await screen.findByRole("button", { name: expandLabel });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: collapseLabel })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "Cambiar de negocio" }));
    const otherToggle = await screen.findByRole("button", { name: expandLabel });
    await waitFor(() => expect(otherToggle).toBeEnabled());
    expect(otherToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("link", { name: "Volver al negocio inicial" }));
    const initialToggle = await screen.findByRole("button", { name: collapseLabel });
    await waitFor(() => expect(initialToggle).toBeEnabled());
    expect(initialToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tab", { name: i18n.t("business:pos.title") })).toBeVisible();
  });
});
