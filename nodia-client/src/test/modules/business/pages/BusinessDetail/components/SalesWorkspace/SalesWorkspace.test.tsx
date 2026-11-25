import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError } from "axios";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogTitle } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import SalesWorkspace from "../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace";
import type { CartLine, PaymentMethod, Sale } from "../../../../../../../modules/business/infrastructure/salesTypes";
import useAuthStore from "../../../../../../../store/authStore";
import { printSaleTicket } from "../../../../../../../modules/business/infrastructure/printSaleTicket";
import { getProduct, getProductByBarcode, getSale } from "../../../../../../../modules/business/infrastructure/salesServices";
import type { ProductEntity } from "../../../../../../../modules/business/infrastructure/types";
import { createAxiosInstance } from "../../../../../../../config/axiosInstance";
import { addCartProduct, cartTotal } from "../../../../../../../modules/business/infrastructure/salesPolicies";
import { sileo } from "sileo";

vi.mock("../../../../../../../modules/business/infrastructure/printSaleTicket", () => ({ printSaleTicket: vi.fn() }));
vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../../../../../../../modules/business/infrastructure/salesServices", async original => ({ ...await original<typeof import("../../../../../../../modules/business/infrastructure/salesServices")>(), getSale: vi.fn(), getProduct: vi.fn(), getProductByBarcode: vi.fn() }));

const state = vi.hoisted(() => ({
  sale: null as Sale | null, lines: [] as CartLine[], paymentMethod: "cash" as PaymentMethod, mobile: false,
  description: "", dirty: false, busy: false, pending: null, storageError: false,
  checkout: vi.fn(), transition: vi.fn(), reset: vi.fn(), setLines: vi.fn(), setPaymentMethod: vi.fn(), setDescription: vi.fn(),
  activeId: "local-a", activeNumber: 1, hasUnsaved: false, newSale: vi.fn(), selectSale: vi.fn(), closeSale: vi.fn(), retryStorage: vi.fn(),
  load: vi.fn(), reconcile: vi.fn(), retry: vi.fn(), save: vi.fn(),
  updateProduct: vi.fn(),
  registrationComplete: null as ((product: ProductEntity) => void | Promise<void>) | null,
  registrationClose: null as (() => void) | null,
}));
vi.mock("@mui/material", async (original) => ({ ...await original<typeof import("@mui/material")>(), useMediaQuery: (query: string) => query.includes("max-width") && state.mobile }));
vi.mock("../../../../../../../modules/business/infrastructure/useSaleDraft", async () => {
  const { useState } = await import("react");
  return { useSaleDraft: () => {
    const [barcode, setBarcode] = useState("");
    const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
    const addProduct = (product: ProductEntity, { clearBarcode }: { clearBarcode?: boolean } = {}) => {
      if (!state.setLines(addCartProduct(state.lines, product))) return false;
      if (clearBarcode) setBarcode("");
      setQuantityDrafts((previous) => {
        const next = { ...previous };
        delete next[product.id];
        return next;
      });
      return true;
    };
    return { ...state, barcode, setBarcode, quantityDrafts, setQuantityDrafts, addProduct, sessions: [{ ...state, id: "local-a", number: 1, quantityDrafts, barcode }] };
  } };
});
vi.mock("../../../../../../../modules/business/infrastructure/useServices", () => ({ useUpdateProduct: () => ({ isPending: false, mutateAsync: state.updateProduct }) }));
vi.mock("../../../../../../../modules/business/infrastructure/useSaleLineImages", () => ({ useSaleLineImages: () => ({ images: {}, remember: vi.fn(), isLoading: false, isFetching: false, isError: false, retry: vi.fn() }) }));
vi.mock("react-router", async (original) => ({ ...await original<typeof import("react-router")>(), useBlocker: () => ({ state: "unblocked" }) }));
vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/PosProductCatalog", () => ({ default: ({ disabled, onSelect }: { disabled: boolean; onSelect: (product: ProductEntity) => void }) => <button disabled={disabled} onClick={() => onSelect(product)}>Pick synthetic existing product</button> }));
vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/PosProductRegistration", () => ({ default: ({ barcode, onClose, onRegistered }: { barcode: string; onClose: () => void; onRegistered: (product: ProductEntity) => void | Promise<void> }) => {
  state.registrationComplete = onRegistered; state.registrationClose = onClose;
  // Keep the real portal/modal stack: the confirmation can still be exiting.
  return <Dialog open transitionDuration={0}><DialogTitle>Product registration boundary</DialogTitle><span>{barcode}</span><button onClick={onClose}>Close registration boundary</button></Dialog>;
} }));
vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesRecords", () => ({ default: () => null }));
vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SalesReports", () => ({ default: () => null }));
const line: CartLine = { product_id: "synthetic-product", name: "Producto de prueba", code: "CODE", barcode: "00123", quantity: 1, expected_product_version: 3, expected_unit_price: "1200", regular_price: "1200", offer_price: null, price_source: "regular" };
const product: ProductEntity = { id: line.product_id, business_id: "business-a", code: "CODE", name: line.name, measurement_unit: "unit", version: 3,
  barcode: "00123", cost_price: 1000, cost_price_tax: 1190, sale_price: 1200, offer_price: null, is_offer_enabled: false, effective_price: "1200", price_source: "regular", has_stock: true, stock: 0, is_active: true };
const completed: Sale = { id: "saved-sale", business_id: "business-a", status: "completed", currency: "CLP", payment_method: "cash", payment_method_description: null, total_amount: "1200", version: 1,
  created_at: "2026-10-30T20:00:00Z", updated_at: "2026-10-30T20:00:00Z", completed_at: "2026-10-30T20:00:00Z", cancelled_at: null, cancellation_reason: null,
  items: [{ id: "saved-line", product_id: line.product_id, position: 0, quantity: 1, product_code_snapshot: null, product_barcode_snapshot: "00123", product_name_snapshot: "Nombre confirmado", measurement_unit_snapshot: "kg", regular_unit_price: "1200", offer_price_snapshot: null, is_offer_enabled_snapshot: false, price_source: "regular", unit_price: "1200", line_total: "1200", product_version: 3 }] };
const renderWorkspace = () => render(<MemoryRouter><SalesWorkspace businessId="business-a" section="pos" /></MemoryRouter>);
const registered = { ...product, id: "newly-registered", name: "New product", barcode: "000000123", version: 1 };
const openRegistration = async () => {
  vi.mocked(getProductByBarcode).mockRejectedValue(Object.assign(new AxiosError("Synthetic miss"), { response: { status: 404, data: { message: "product:not_found" } } }));
  await userEvent.type(screen.getByLabelText("Escanear o ingresar código de barras"), "000000123{Enter}");
  await screen.findByRole("dialog", { name: "Código de barras sin registrar" });
  await userEvent.click(screen.getByRole("button", { name: "Sí, registrar producto" }));
  await screen.findByRole("dialog", { name: "Product registration boundary" });
};

describe("manual point of sale checkout controls", () => {
  it("adds the completed product once with quantity one, preserves existing lines and returns to the clean scanner", async () => {
    const existing = { ...line, expected_unit_price: "2000", regular_price: "2000" }; state.lines = [existing];
    state.setLines.mockReturnValue(true);
    renderWorkspace(); await openRegistration();
    const complete = state.registrationComplete!;
    await act(async () => { await complete(registered); await complete(registered); });
    expect(state.setLines).toHaveBeenCalledTimes(1);
    const next: CartLine[] = state.setLines.mock.calls[0][0];
    expect(next[0]).toMatchObject({ product_id: registered.id, quantity: 1, expected_unit_price: "1200" }); expect(next[1]).toEqual(existing);
    expect(cartTotal(next)).toBe("3200"); expect(getProduct).not.toHaveBeenCalled();
    await act(async () => state.registrationClose!());
    await waitFor(() => expect(screen.getByLabelText("Escanear o ingresar código de barras")).toHaveFocus());
    expect(screen.getByLabelText("Escanear o ingresar código de barras")).toHaveValue("");
  });
  it.each(["unavailable", "read_failure", "cart_rejected"])("keeps the saved catalog product and existing sale when automatic addition fails: %s", async failure => {
    state.lines = [line]; state.setLines.mockReturnValue(failure !== "cart_rejected");
    renderWorkspace(); await openRegistration();
    const saved = failure === "read_failure" ? { ...registered, effective_price: undefined, price_source: undefined } : failure === "unavailable" ? { ...registered, has_stock: false } : registered;
    if (failure === "read_failure") vi.mocked(getProduct).mockRejectedValue(new AxiosError("Synthetic read failed"));
    const complete = state.registrationComplete!;
    await act(async () => { await complete(saved); await complete(saved); });
    expect(state.lines).toEqual([line]);
    expect(state.setLines).toHaveBeenCalledTimes(failure === "cart_rejected" ? 1 : 0);
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ title: "Producto guardado; no se agregó a la venta" }));
    if (failure === "read_failure") expect(getProduct).toHaveBeenCalledExactlyOnceWith(registered.id);
  });
  it("hydrates an old response by exact identity and revision without inventing a price", async () => {
    state.setLines.mockReturnValue(true);
    renderWorkspace(); await openRegistration();
    vi.mocked(getProduct).mockResolvedValue(registered);
    await act(async () => state.registrationComplete!({ ...registered, effective_price: undefined, price_source: undefined }));
    expect(getProduct).toHaveBeenCalledExactlyOnceWith(registered.id);
    expect(state.setLines).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ product_id: registered.id, quantity: 1, expected_unit_price: "1200" })]);
  });
  it("does not add a saved product to another cart or clear its scanner when its hydration finishes late", async () => {
    state.lines = [line]; state.setLines.mockReturnValue(true);
    let resolveRead!: (value: ProductEntity) => void;
    vi.mocked(getProduct).mockImplementation(() => new Promise(resolve => { resolveRead = resolve; }));
    const { rerender } = renderWorkspace(); await openRegistration();
    const close = state.registrationClose!;
    let completion!: Promise<void>;
    act(() => { completion = Promise.resolve(state.registrationComplete!({ ...registered, effective_price: undefined, price_source: undefined })); });
    rerender(<MemoryRouter><SalesWorkspace businessId="business-b" section="pos" /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Escanear o ingresar código de barras"), { target: { value: "current-cart-input" } });
    await act(async () => { resolveRead(registered); await completion; close(); });
    expect(state.setLines).not.toHaveBeenCalled(); expect(state.lines).toEqual([line]);
    expect(screen.getByLabelText("Escanear o ingresar código de barras")).toHaveValue("current-cart-input");
  });
  it("offers registration for an unknown code and clears/refocuses on No or form cancellation without changing the cart", async () => {
    state.lines = [line];
    vi.mocked(getProductByBarcode).mockRejectedValue(Object.assign(new AxiosError("Synthetic miss"), { response: { status: 404, data: { message: "product:not_found" } } }));
    renderWorkspace();
    const scanner = screen.getByLabelText("Escanear o ingresar código de barras");
    const newSale = screen.getByRole("button", { name: "Nueva venta" });
    const catalog = screen.getByRole("button", { name: "Pick synthetic existing product" });
    await userEvent.type(scanner, "000000123{Enter}");
    await screen.findByRole("dialog", { name: "Código de barras sin registrar" });
    expect(scanner).toBeDisabled(); expect(newSale).toBeDisabled(); expect(catalog).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "No, seguir escaneando" }));
    await waitFor(() => expect(scanner).toHaveFocus()); expect(scanner).toHaveValue("");
    await userEvent.type(scanner, "000000123{Enter}");
    await screen.findByRole("dialog", { name: "Código de barras sin registrar" });
    await userEvent.click(screen.getByRole("button", { name: "Sí, registrar producto" }));
    // Registration must be accessible while the previous confirmation is exiting.
    expect(screen.getByRole("dialog", { name: "Product registration boundary" })).toHaveTextContent("000000123");
    await userEvent.click(screen.getByRole("button", { name: "Close registration boundary" }));
    await waitFor(() => expect(scanner).toHaveFocus()); expect(scanner).toHaveValue("");
    expect(state.setLines).not.toHaveBeenCalled(); expect(state.lines).toEqual([line]);
  });
  it("preserves the explicit existing-product association branch and ignores its late result after changing business", async () => {
    vi.mocked(getProductByBarcode).mockRejectedValue(Object.assign(new AxiosError("Synthetic miss"), { response: { status: 404, data: { message: "product:not_found" } } }));
    let resolveUpdate!: (product: ProductEntity) => void;
    state.updateProduct.mockImplementation(() => new Promise(resolve => { resolveUpdate = resolve; }));
    const { rerender } = renderWorkspace();
    const scanner = screen.getByLabelText("Escanear o ingresar código de barras");
    await userEvent.type(scanner, "000000123{Enter}");
    await screen.findByRole("dialog", { name: "Código de barras sin registrar" });
    await userEvent.click(screen.getByRole("button", { name: "Asociar a un producto existente" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pick synthetic existing product" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Pick synthetic existing product" }));
    await userEvent.click(screen.getByRole("button", { name: "Vincular código de barras" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Vincular código de barras" })).getByRole("button", { name: "Confirmar" }));
    expect(state.updateProduct).toHaveBeenCalledWith({ id: product.id, payload: { barcode: "000000123", expected_version: product.version } });
    rerender(<MemoryRouter><SalesWorkspace businessId="business-b" section="pos" /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Escanear o ingresar código de barras"), { target: { value: "new-context-draft" } });
    await act(async () => resolveUpdate({ ...product, version: 4, barcode: "000000123" }));
    expect(screen.getByLabelText("Escanear o ingresar código de barras")).toHaveValue("new-context-draft");
    expect(state.setLines).not.toHaveBeenCalled();
  });
  it("recovers the latest revision after a localized association conflict and requires a second explicit confirmation", async () => {
    const conflict = await createAxiosInstance({ adapter: async config => {
      throw new AxiosError("Synthetic conflict", "ERR_BAD_RESPONSE", config, undefined, { config, status: 409, statusText: "Conflict", headers: {}, data: { message: "product:version_conflict" } });
    } }).put("/products/synthetic-product").catch((error: unknown) => error);
    expect((conflict as AxiosError<{ message: string }>).response?.data.message).not.toBe("product:version_conflict");
    vi.mocked(getProductByBarcode).mockRejectedValue(Object.assign(new AxiosError("Synthetic miss"), { response: { status: 404, data: { message: "product:not_found" } } }));
    state.updateProduct.mockRejectedValueOnce(conflict).mockResolvedValueOnce({ ...product, version: 5, barcode: "000000123" });
    vi.mocked(getProduct).mockResolvedValue({ ...product, version: 4, name: "Reviewed current product" });
    renderWorkspace();
    const scanner = screen.getByLabelText("Escanear o ingresar código de barras");
    await userEvent.type(scanner, "000000123{Enter}");
    await screen.findByRole("dialog", { name: "Código de barras sin registrar" });
    await userEvent.click(screen.getByRole("button", { name: "Asociar a un producto existente" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pick synthetic existing product" })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Pick synthetic existing product" }));
    await userEvent.click(screen.getByRole("button", { name: "Vincular código de barras" }));
    const dialog = screen.getByRole("dialog", { name: "Vincular código de barras" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(getProduct).toHaveBeenCalledExactlyOnceWith(product.id));
    await waitFor(() => expect(dialog).toHaveTextContent("Reviewed current product"));
    expect(state.updateProduct).toHaveBeenCalledTimes(1);
    expect(dialog).toBeInTheDocument(); expect(scanner).toHaveValue("000000123");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(state.updateProduct).toHaveBeenCalledTimes(2));
    expect(state.updateProduct.mock.calls[0][0]).toMatchObject({ payload: { expected_version: 3, barcode: "000000123" } });
    expect(state.updateProduct.mock.calls[1][0]).toMatchObject({ payload: { expected_version: 4, barcode: "000000123" } });
    await waitFor(() => expect(scanner).toHaveFocus()); expect(scanner).toHaveValue("");
    expect(state.setLines).not.toHaveBeenCalled();
  });
  it("applies a sale-only price without reading or updating the product", async () => {
    Object.assign(state, { lines: [line], dirty: true });
    state.setLines.mockReturnValue(true);
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Editar precio Producto de prueba" }));
    await userEvent.clear(screen.getByLabelText("Precio CLP"));
    await userEvent.type(screen.getByLabelText("Precio CLP"), "800");
    await userEvent.click(screen.getByRole("button", { name: "Modificar sólo para esta venta" }));
    expect(state.setLines).toHaveBeenLastCalledWith([expect.objectContaining({ expected_unit_price: "1200", unit_price_override: "800" })]);
    expect(getProduct).not.toHaveBeenCalled();
    expect(state.updateProduct).not.toHaveBeenCalled();
  });
  it("updates the permanent normal price/costs with its version and removes the sale override only after success", async () => {
    Object.assign(state, { lines: [{ ...line, unit_price_override: "800" }], dirty: true });
    state.setLines.mockReturnValue(true);
    vi.mocked(getProduct).mockResolvedValue(structuredClone(product));
    state.updateProduct.mockResolvedValue({ ...product, version: 4, sale_price: 13000, effective_price: "13000" });
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Editar precio Producto de prueba" }));
    await userEvent.clear(screen.getByLabelText("Precio CLP"));
    await userEvent.type(screen.getByLabelText("Precio CLP"), "13000");
    await userEvent.click(screen.getByRole("button", { name: "Guardar precio normal del producto y desactivar la oferta" }));
    await waitFor(() => expect(state.updateProduct).toHaveBeenCalledWith({ id: line.product_id, payload: { expected_version: 3, sale_price: 13000, is_offer_enabled: false } }));
    await waitFor(() => expect(state.setLines).toHaveBeenCalled());
    const saved = state.setLines.mock.lastCall?.[0][0];
    expect(saved).toMatchObject({ expected_unit_price: "13000", expected_product_version: 4, quantity: 1 });
    expect(saved.unit_price_override).toBeUndefined();
  });
  it("preserves inline editing and the existing sale price when the product revision changed", async () => {
    Object.assign(state, { lines: [line], dirty: true });
    vi.mocked(getProduct).mockResolvedValue({ ...product, version: 4 });
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Editar precio Producto de prueba" }));
    await userEvent.clear(screen.getByLabelText("Precio CLP"));
    await userEvent.type(screen.getByLabelText("Precio CLP"), "900");
    await userEvent.click(screen.getByRole("button", { name: "Guardar precio normal del producto y desactivar la oferta" }));
    await waitFor(() => expect(screen.getByLabelText("Precio CLP")).toBeEnabled());
    expect(screen.getByLabelText("Precio CLP")).toHaveValue("900");
    expect(state.updateProduct).not.toHaveBeenCalled();
    expect(state.setLines).not.toHaveBeenCalled();
  });
  it("does not send the permanent mutation after the authenticated session changes during its read", async () => {
    Object.assign(state, { lines: [line], dirty: true });
    let resolveProduct!: (value: ProductEntity) => void;
    vi.mocked(getProduct).mockImplementation(() => new Promise(resolve => { resolveProduct = resolve; }));
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Editar precio Producto de prueba" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar precio normal del producto y desactivar la oferta" }));
    expect(screen.getByLabelText("Precio CLP")).toBeDisabled();
    useAuthStore.setState({ sessionVersion: useAuthStore.getState().sessionVersion + 1 });
    resolveProduct(structuredClone(product));
    await waitFor(() => expect(screen.getByLabelText("Precio CLP")).toBeEnabled());
    expect(state.updateProduct).not.toHaveBeenCalled();
    expect(state.setLines).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    state.setPaymentMethod.mockReset();
    state.setLines.mockReset();
    state.updateProduct.mockReset();
    state.registrationComplete = null; state.registrationClose = null;
    state.checkout.mockReset();
    vi.mocked(getProduct).mockReset();
    vi.mocked(getProductByBarcode).mockReset();
    vi.mocked(printSaleTicket).mockReset();
    vi.mocked(getSale).mockReset().mockResolvedValue(structuredClone(completed));
    useAuthStore.setState({ user: { id: "qa-actor", name: "QA" }, token: "synthetic-session", sessionStatus: "authenticated", expiresAt: Date.now() + 60000 });
    Object.assign(state, { sale: null, lines: [], dirty: false, busy: false, pending: null, description: "", paymentMethod: "cash", mobile: false });
  });
  it("starts with scanner focus, explicit cash and no empty alert or draft action", async () => {
    renderWorkspace();
    await waitFor(() => expect(screen.getByLabelText("Escanear o ingresar código de barras")).toHaveFocus());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeDisabled();
  });
  it("keeps scanner and payment available together on mobile without remounting or losing local inputs", async () => {
    Object.assign(state, { mobile: true, lines: [line], dirty: true });
    state.setPaymentMethod.mockImplementation((value: PaymentMethod) => { state.paymentMethod = value; });
    const { rerender } = renderWorkspace();
    const scanner = screen.getByLabelText("Escanear o ingresar código de barras");
    const selectedTab = screen.getByRole("tab", { name: /Venta 1/ });
    const payment = screen.getByRole("region", { name: "Pago y total" });
    await waitFor(() => expect(scanner).toHaveFocus());
    await userEvent.type(scanner, "000123");
    await userEvent.clear(screen.getByLabelText("Cantidad"));
    await userEvent.click(within(payment).getByRole("button", { name: "Débito" }));
    rerender(<MemoryRouter><SalesWorkspace businessId="business-a" section="pos" /></MemoryRouter>);
    expect(scanner).toBeVisible();
    expect(payment).toBeVisible();
    expect(screen.getByLabelText("Escanear o ingresar código de barras")).toBe(scanner);
    expect(scanner).toHaveValue("000123");
    expect(screen.getByLabelText("Cantidad")).toHaveValue("");
    expect(screen.getByRole("tab", { name: /Venta 1/ })).toBe(selectedTab);
    expect(selectedTab).toHaveAttribute("aria-selected", "true");
    expect(state.setLines).not.toHaveBeenCalled();
    expect(within(payment).getByRole("button", { name: "Débito" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeDisabled();
    expect(state.checkout).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation before a single checkout and preserves the modal on failure", async () => {
    Object.assign(state, { lines: [line], dirty: true }); state.checkout.mockResolvedValue(null);
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    expect(state.checkout).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Producto de prueba/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(state.checkout).toHaveBeenCalledTimes(1); expect(state.transition).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    expect(printSaleTicket).not.toHaveBeenCalled();
    state.checkout.mockResolvedValueOnce(completed);
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(state.checkout).toHaveBeenCalledTimes(2); expect(printSaleTicket).not.toHaveBeenCalled();
  });
  it("blocks confirmation for an incomplete quantity without dropping the last valid cart line", async () => {
    Object.assign(state, { lines: [line], dirty: true });
    renderWorkspace();
    await userEvent.clear(screen.getByLabelText("Cantidad"));
    expect(screen.getByRole("button", { name: "Confirmar venta" })).toBeDisabled();
    expect(screen.getByLabelText("Cantidad")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/máximo de 3 decimales/)).not.toBeInTheDocument();
    expect(state.setLines).not.toHaveBeenCalled(); expect(state.checkout).not.toHaveBeenCalled();
  });
  it("allows a mixed cart while human confirmation shows only positive rows", async () => {
    Object.assign(state, { lines: [line, { ...line, product_id: "zero-product", name: "Producto en cero", quantity: 0 }], dirty: true });
    renderWorkspace();
    const confirm = screen.getByRole("button", { name: "Confirmar venta" });
    expect(confirm).toBeEnabled(); await userEvent.click(confirm);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/Producto en cero/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Producto de prueba/)).toBeInTheDocument();
    expect(state.checkout).not.toHaveBeenCalled();
  });
  it("saves before printing the confirmed snapshot and can reprint without another checkout", async () => {
    let resolve!: (sale: Sale | null) => void;
    state.checkout.mockImplementation(() => new Promise<Sale | null>(done => { resolve = done; }));
    Object.assign(state, { lines: [line], dirty: true });
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar e imprimir vale" }));
    expect(state.checkout).toHaveBeenCalledTimes(1); expect(printSaleTicket).not.toHaveBeenCalled();
    resolve(completed);
    await waitFor(() => expect(printSaleTicket).toHaveBeenCalledTimes(1));
    expect(vi.mocked(printSaleTicket).mock.calls[0][0].lines).toEqual([]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Imprimir con detalle" }));
    await waitFor(() => expect(printSaleTicket).toHaveBeenCalledTimes(2));
    expect(vi.mocked(printSaleTicket).mock.calls[1][0].lines[0].name).toBe("Nombre confirmado");
    expect(state.checkout).toHaveBeenCalledTimes(1);
  });
  it("dismisses the saved sale notice by keyboard without a commercial write and shows the next receipt", async () => {
    const user = userEvent.setup();
    const next = { ...completed, id: "next-saved-sale" };
    Object.assign(state, { lines: [line], dirty: true });
    state.checkout.mockResolvedValueOnce(completed).mockResolvedValueOnce(next);
    const { container } = renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const alert = screen.getByRole("alert");
    const print = within(alert).getByRole("button", { name: "Imprimir con detalle" });
    print.focus();
    await user.tab();
    expect(within(alert).getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(alert).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveFocus();
    expect(state.checkout).toHaveBeenCalledTimes(1);
    expect(state.transition).not.toHaveBeenCalled();
    expect(getSale).not.toHaveBeenCalled();
    expect(printSaleTicket).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText(next.id)).toBeInTheDocument();
  });
  it("always previews product detail with explicit printing actions and no remembered format selection", async () => {
    Object.assign(state, { lines: [line], dirty: true });
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    let dialog = screen.getByRole("dialog");
    const preview = within(dialog).getByRole("article", { name: "Vista previa de venta" });
    const total = within(preview).getByText("TOTAL CLP").parentElement?.textContent;
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(preview).getByRole("list")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar e imprimir vale" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Confirmar e imprimir con detalle" })).toBeEnabled();
    expect(within(preview).getByText(/Medio de pago: Efectivo/)).toBeInTheDocument();
    expect(within(preview).getByText("Producto de prueba")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Producto de prueba")).toBeInTheDocument();
    expect(within(dialog).getByText("TOTAL CLP").parentElement?.textContent).toBe(total);
    expect(state.checkout).not.toHaveBeenCalled();
  });
  it("captures the explicit detailed action before awaiting checkout and blocks another printing choice in flight", async () => {
    let resolve!: (sale: Sale | null) => void;
    Object.assign(state, { lines: [line], dirty: true });
    state.checkout.mockImplementation(() => new Promise<Sale | null>(done => { resolve = done; }));
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar e imprimir con detalle" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar e imprimir vale" }));
    expect(state.checkout).toHaveBeenCalledTimes(1); expect(printSaleTicket).not.toHaveBeenCalled();
    resolve(completed);
    await waitFor(() => expect(printSaleTicket).toHaveBeenCalledTimes(1));
    expect(vi.mocked(printSaleTicket).mock.calls[0][0].lines[0].name).toBe("Nombre confirmado");
    expect(state.checkout).toHaveBeenCalledTimes(1);
    expect(getSale).not.toHaveBeenCalled();
  });
  it("reprints a saved sale as a total slip or detailed ticket without another commercial write", async () => {
    Object.assign(state, { lines: [line], sale: completed });
    renderWorkspace();
    const payment = screen.getByRole("region", { name: "Pago y total" });
    await userEvent.click(within(payment).getByRole("button", { name: "Imprimir vale" }));
    await waitFor(() => expect(printSaleTicket).toHaveBeenCalledTimes(1));
    const summary = vi.mocked(printSaleTicket).mock.calls[0][0];
    expect(summary.lines).toEqual([]);
    expect(screen.getAllByRole("button", { name: "Imprimir con detalle" })).toHaveLength(1);
    await userEvent.click(within(payment).getByRole("button", { name: "Imprimir con detalle" }));
    await waitFor(() => expect(printSaleTicket).toHaveBeenCalledTimes(2));
    const detailed = vi.mocked(printSaleTicket).mock.calls[1][0];
    expect(detailed.lines[0].name).toBe("Nombre confirmado");
    expect({ ...detailed, lines: [] }).toEqual(summary);
    expect(getSale).toHaveBeenCalledTimes(2);
    expect(state.checkout).not.toHaveBeenCalled();
    expect(state.transition).not.toHaveBeenCalled();
  });
  it("keeps failed checkout open without printing and closes it after save even if printing fails", async () => {
    Object.assign(state, { lines: [line], dirty: true }); state.checkout.mockResolvedValueOnce(null).mockResolvedValueOnce(completed);
    vi.mocked(printSaleTicket).mockRejectedValue(new Error("Printer dialog unavailable"));
    renderWorkspace(); await userEvent.click(screen.getByRole("button", { name: "Confirmar venta" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar e imprimir con detalle" }));
    expect(printSaleTicket).not.toHaveBeenCalled(); expect(screen.getByRole("dialog")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Producto de prueba")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar e imprimir vale" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Confirmar e imprimir con detalle" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar e imprimir con detalle" }));
    await waitFor(() => expect(printSaleTicket).toHaveBeenCalledTimes(1));
    expect(vi.mocked(printSaleTicket).mock.calls[0][0].lines[0].name).toBe("Nombre confirmado");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Imprimir con detalle" })).toBeEnabled();
    expect(state.checkout).toHaveBeenCalledTimes(2);
  });
  it("closes an empty cart directly even after local edits, without a confirmation or server write", async () => {
    Object.assign(state, { lines: [], dirty: true }); state.closeSale.mockReturnValue(true);
    renderWorkspace();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar Venta 1" }));
    expect(state.closeSale).toHaveBeenCalledWith("local-a");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(state.checkout).not.toHaveBeenCalled(); expect(state.transition).not.toHaveBeenCalled();
  });

  it("places the active sale above the scanner and the new sale action before the checkout region", () => {
    Object.assign(state, { lines: [line], dirty: true }); renderWorkspace();
    const products = screen.getByRole("region", { name: "Productos de la venta" });
    expect(within(products).getByText("Producto de prueba", { selector: "p" })).toBeInTheDocument();
    const payment = screen.getByRole("region", { name: "Pago y total" });
    const newSale = screen.getByRole("button", { name: "Nueva venta" });
    const activeSale = screen.getByRole("heading", { name: "Venta 1" });
    const scanner = screen.getByLabelText("Escanear o ingresar código de barras");
    expect(activeSale.parentElement).toBe(scanner.closest("form")?.parentElement);
    expect(activeSale.compareDocumentPosition(scanner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(newSale.parentElement).toBe(payment.parentElement);
    expect(newSale.compareDocumentPosition(payment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(payment).queryByText("Producto de prueba")).not.toBeInTheDocument();
    expect(within(payment).queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(within(payment).getAllByRole("button")).toHaveLength(5);
    const total = within(payment).getByRole("heading", { name: "Total CLP" });
    const methods = within(payment).getByRole("group", { name: "Medio de pago" });
    const checkout = within(payment).getByRole("button", { name: "Confirmar venta" });
    expect(total.compareDocumentPosition(methods) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(methods.compareDocumentPosition(checkout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

});
