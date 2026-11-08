import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProductModal from "../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductModal";
import type { ProductEntity } from "../../../../../../../modules/business/infrastructure/types";
import { getProduct } from "../../../../../../../modules/business/infrastructure/salesServices";

vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/ProductImageDraft", () => ({ default: () => <div>image boundary</div> }));
vi.mock("../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/hooks/useDeferredProductSave", async () => {
  const { useState } = await import("react");
  return { useDeferredProductSave: ({ persistFields, initialProduct }: { persistFields: (data: unknown) => Promise<unknown>; initialProduct: ProductEntity | null }) => {
    const [savedProduct, adoptReviewed] = useState(initialProduct);
    return { savedProduct, adoptReviewed, save: persistFields, busy: false, phase: "idle", pendingIntent: null, reconcile: vi.fn(), cancel: vi.fn() };
  } };
});
vi.mock("../../../../../../../modules/business/infrastructure/salesServices", () => ({ getProduct: vi.fn() }));
const product: ProductEntity = { id: "product-1", business_id: "business-1", code: "SUP-1", name: "Synthetic product", cost_price: 1000, cost_price_tax: 1190,
  sale_price: 1547, stock: 0, has_stock: false, barcode: "001234", is_offer_enabled: false, offer_price: 2000, version: 3, is_active: true };
describe("ProductModal", () => {
  const submit = vi.fn();
  beforeEach(() => vi.clearAllMocks());
  const input = (name: string) => screen.getByTestId(`product-${name}-input`).querySelector("input")!;
  const chooseAvailability = async (label: string) => { const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Disponibilidad" })); await user.click(screen.getByRole("option", { name: label })); };
  it.each([undefined, product])("focuses the first barcode field on opening and reopening create/edit without submitting", async (initialData) => {
    const props = { businessId: "business-1", onClose: vi.fn(), onSubmit: submit, initialData };
    const { rerender } = render(<ProductModal {...props} open />);
    await waitFor(() => {
      expect(input("barcode")).toHaveFocus();
      expect(input("barcode").selectionStart).toBe(0);
    });
    const fields = screen.getByRole("dialog").querySelectorAll("input");
    expect(fields[0]).toBe(input("barcode"));
    const user = userEvent.setup();
    await user.keyboard("00005678{Enter}");
    expect(input("barcode")).toHaveValue("00005678");
    expect(submit).not.toHaveBeenCalled();
    await user.click(input("name"));
    rerender(<ProductModal {...props} open={false} />);
    rerender(<ProductModal {...props} open />);
    await waitFor(() => {
      expect(input("barcode")).toHaveFocus();
      expect(input("barcode").selectionStart).toBe(0);
    });
    expect(input("barcode")).toHaveValue(initialData?.barcode ?? "");
    expect(input("barcode").selectionStart).toBe(0);
    expect(input("barcode").selectionEnd).toBe(initialData?.barcode?.length ?? 0);
    expect(submit).not.toHaveBeenCalled();
  });
  it("waits for opening controls to become writable once and does not steal focus after a later refetch", async () => {
    const props = { businessId: "business-1", onClose: vi.fn(), onSubmit: submit, initialData: product };
    const { rerender } = render(<ProductModal {...props} open isSubmitting />);
    expect(input("barcode")).toBeDisabled();
    rerender(<ProductModal {...props} open isSubmitting={false} />);
    await waitFor(() => expect(input("barcode")).toHaveFocus());
    const user = userEvent.setup();
    await user.click(input("name"));
    await user.type(input("name"), " draft");
    rerender(<ProductModal {...props} open isSubmitting />);
    rerender(<ProductModal {...props} open isSubmitting={false} providers={[]} />);
    await waitFor(() => expect(input("name")).toBeEnabled());
    expect(input("barcode")).not.toHaveFocus();
    expect(input("name")).toHaveValue("Synthetic product draft");
    expect(submit).not.toHaveBeenCalled();
  });
  it("starts a new product available and separates supplier code, barcode and optional image", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} />);
    expect(input("code")).toBeInTheDocument(); expect(input("barcode")).toBeInTheDocument();
    expect(screen.queryByTestId("product-stock-input")).not.toBeInTheDocument();
    expect(screen.getByText("image boundary")).toBeInTheDocument();
    const user = userEvent.setup(); await user.type(input("code"), "SUP"); await user.type(input("name"), "Synthetic"); await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ has_stock: true });
  });
  it("creates without a supplier code and starts the product with units", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} />);
    expect(input("code")).not.toBeRequired();
    expect(screen.getByRole("button", { name: "Unidad de medida" })).toHaveTextContent("Unidades");
    const user = userEvent.setup(); await user.type(input("name"), "Manual sin código");
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ code: null, measurement_unit: "unit", name: "Manual sin código" });
  });
  it.each([[255, true], [256, false]] as const)("validates %i astral supplier-code characters without changing the barcode", async (length, valid) => {
    const code = "🧾".repeat(length);
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={{ ...product, code }} />);
    fireEvent.click(screen.getByTestId("save-product-btn"));
    if (valid) {
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(submit.mock.calls[0][0]).toMatchObject({ code, barcode: product.barcode });
    } else {
      await waitFor(() => expect(input("code")).toHaveAttribute("aria-invalid", "true"));
      expect(submit).not.toHaveBeenCalled();
      expect(input("code")).toHaveValue(code);
    }
    expect(input("barcode")).toHaveValue(product.barcode);
  });
  it("changes the measurement explicitly and clears a code without affecting barcode identity", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup(); await user.clear(input("code"));
    await user.click(screen.getByRole("button", { name: "Unidad de medida" }));
    await user.click(screen.getByRole("option", { name: "Kilos" }));
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ code: null, measurement_unit: "kg", barcode: "001234", expected_version: 3 });
  });
  it("submits manual false without numeric stock and preserves leading barcode zeroes", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} />);
    const user = userEvent.setup(); await user.type(input("code"), "SUP"); await user.type(input("name"), "Synthetic"); await chooseAvailability("No disponible");
    expect(input("barcode")).toHaveAttribute("type", "text");
    await user.type(input("barcode"), "001234{Enter}");
    expect(submit).not.toHaveBeenCalled();
    expect(input("barcode")).toHaveValue("001234");
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ code: "SUP", barcode: "001234", has_stock: false, is_offer_enabled: false, offer_price: 0 });
    expect(submit.mock.calls[0][0]).not.toHaveProperty("stock");
  });
  it("selects an existing barcode on focus and keeps a replacement scan local until explicit save", async () => {
    const parentEnter = vi.fn();
    render(<div onKeyDown={(event) => { if (event.key === "Enter") parentEnter(); }}><ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} /></div>);
    const user = userEvent.setup();
    const barcode = input("barcode");
    expect(barcode).toHaveValue("001234");
    await user.click(input("name"));
    await user.click(barcode);
    expect(barcode.selectionStart).toBe(0);
    expect(barcode.selectionEnd).toBe(6);
    await user.keyboard("00005678{Enter}");
    const scannerEnter = createEvent.keyDown(barcode, { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    fireEvent(barcode, scannerEnter);
    expect(scannerEnter.defaultPrevented).toBe(true);
    expect(barcode).toHaveValue("00005678");
    expect(input("code")).toHaveValue("SUP-1");
    expect(submit).not.toHaveBeenCalled();
    expect(parentEnter).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ code: "SUP-1", barcode: "00005678", expected_version: 3 });
  });
  it("creates a product with an unassigned barcode without copying its supplier code", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} />);
    const user = userEvent.setup();
    await user.type(input("code"), "SUP-ONLY");
    await user.type(input("name"), "No barcode product");
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ code: "SUP-ONLY", barcode: null, has_stock: true });
  });
  it("prefills existing values, availability and activity without rewriting them", () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={{ ...product, is_active: false }} />);
    expect(input("code")).toHaveValue("SUP-1"); expect(input("barcode")).toHaveValue("001234");
    expect(screen.getByTestId("product-active-switch").querySelector("input")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Disponibilidad" })).toHaveTextContent("No disponible");
  });
  it("preserves unknown availability in an existing product and keeps its explicit classification gate", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={{ ...product, has_stock: null }} />);
    expect(screen.getByRole("button", { name: "Disponibilidad" })).not.toHaveTextContent("Disponible");
    await userEvent.setup().click(screen.getByTestId("save-product-btn"));
    expect(submit).not.toHaveBeenCalled(); expect(await screen.findByText("Seleccione la disponibilidad manualmente.")).toBeInTheDocument();
  });
  it("links only net and gross costs, leaving regular and alternate prices untouched", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup(); await user.clear(input("cost-price")); await user.type(input("cost-price"), "100000");
    expect(input("cost-tax")).toHaveValue(119000); expect(input("sale-price")).toHaveValue(1547); expect(input("offer-price")).toHaveValue(2000);
    await user.clear(input("tax-rate")); await user.type(input("tax-rate"), "10");
    expect(input("cost-tax")).toHaveValue(110000); expect(input("sale-price")).toHaveValue(1547); expect(input("offer-price")).toHaveValue(2000);
  });
  it("applies the gross-cost suggestion explicitly without storing its local markup", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    fireEvent.change(input("suggested-markup"), { target: { value: "50" } });
    expect(input("sale-price")).toHaveValue(1547);
    fireEvent.click(screen.getByRole("button", { name: "Usar precio sugerido" }));
    expect(input("sale-price")).toHaveValue(1785);
    expect(input("cost-price")).toHaveValue(1000);
    expect(input("cost-tax")).toHaveValue(1190);
    fireEvent.change(input("cost-tax"), { target: { value: "2380" } });
    expect(input("sale-price")).toHaveValue(1785);
    fireEvent.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ sale_price: 1785, cost_price: 2000, cost_price_tax: 2380 });
    expect(submit.mock.calls[0][0]).not.toHaveProperty("markup");
    expect(submit.mock.calls[0][0]).not.toHaveProperty("suggested_markup");
    expect(screen.queryByTestId("product-profit-margin-input")).not.toBeInTheDocument();
  });
  it("allows a higher alternate price and preserves its configured value when disabled", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={{ ...product, is_offer_enabled: true }} />);
    await userEvent.setup().click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({ sale_price: 1547, offer_price: 2000, is_offer_enabled: true, expected_version: 3 });
  });
  it("does not turn an empty alternate input into zero or fall back while enabled", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={{ ...product, is_offer_enabled: true }} />);
    const user = userEvent.setup(); await user.clear(input("offer-price")); await user.click(screen.getByTestId("save-product-btn"));
    expect(submit).not.toHaveBeenCalled(); expect(input("offer-price")).toHaveValue(null); expect(await screen.findByText("Ingrese un importe entero CLP válido.")).toBeInTheDocument();
  });
  it("reviews a newer server version explicitly while preserving the edited form", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...product, name: "Other session name", version: 4 });
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup(); await user.clear(input("name")); await user.type(input("name"), "My draft name");
    await user.click(screen.getByRole("button", { name: "Comprobar cambios recientes del producto" }));
    const row = await screen.findByRole("row", { name: /Nombre del Producto/ });
    expect(within(row).getByText("Other session name")).toBeInTheDocument();
    expect(within(row).getByText("My draft name")).toBeInTheDocument();
    expect(within(row).getByText("Modificado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(input("name")).toHaveValue("My draft name");
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toMatchObject({ name: "My draft name", expected_version: 4 });
  });
  it("starts new alternative prices at zero while preserving an existing unassigned value", () => {
    const { rerender } = render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} />);
    expect(input("offer-price")).toHaveValue(0);
    rerender(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={{ ...product, offer_price: null }} />);
    expect(input("offer-price")).toHaveValue(null);
  });
  it("keeps field labels accessible and opens their help without submitting", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ayuda sobre Código de factura / proveedor" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Opcional");
    expect(input("code")).toHaveAccessibleName("Código de factura / proveedor");
    expect(submit).not.toHaveBeenCalled();
  });
  it("keeps manually typed sale prices independent from costs, tax and alternate price", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup();
    await user.clear(input("sale-price"));
    expect(input("sale-price")).toHaveValue(null); expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    await user.type(input("sale-price"), "1200");
    expect(input("sale-price")).toHaveValue(1200); expect(input("cost-tax")).toHaveValue(1190); expect(input("cost-price")).toHaveValue(1000);
    expect(input("tax-rate")).toHaveValue(19); expect(input("offer-price")).toHaveValue(2000);
    await user.click(screen.getByTestId("save-product-btn"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ sale_price: 1200, cost_price_tax: 1190, cost_price: 1000, has_stock: false, offer_price: 2000 });
  });
  it("keeps a real zero sale price distinct from empty without rewriting costs", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup(); await user.clear(input("sale-price"));
    expect(input("sale-price")).toHaveValue(null); expect(input("cost-tax")).toHaveValue(1190); expect(input("cost-price")).toHaveValue(1000);
    fireEvent.submit(screen.getByTestId("save-product-btn").closest("[role=dialog]")!.querySelector("form")!);
    expect(submit).not.toHaveBeenCalled();
    await user.type(input("sale-price"), "0");
    expect(input("cost-tax")).toHaveValue(1190); expect(input("cost-price")).toHaveValue(1000); expect(input("offer-price")).toHaveValue(2000);
    expect(screen.getByTestId("save-product-btn")).not.toBeDisabled();
  });
  it("blocks invalid rates and derived overflow without clamping the typed source or submitting stale costs", async () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup();
    fireEvent.change(input("cost-price"), { target: { value: "2147483647" } });
    expect(input("cost-price")).toHaveValue(2147483647); expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Revise los importes");
    fireEvent.submit(screen.getByTestId("save-product-btn").closest("[role=dialog]")!.querySelector("form")!);
    await waitFor(() => expect(submit).not.toHaveBeenCalled());
    fireEvent.change(input("cost-price"), { target: { value: "1000" } });
    expect(screen.getByTestId("save-product-btn")).not.toBeDisabled();
    await user.clear(input("tax-rate")); expect(input("tax-rate")).toHaveValue(null); expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    await user.type(input("tax-rate"), "0"); expect(input("cost-tax")).toHaveValue(1000); expect(input("sale-price")).toHaveValue(1547);
  });
  it("retains the manual sale price, original costs and dialog when saving fails", async () => {
    const onClose = vi.fn(); submit.mockRejectedValueOnce(new Error("Synthetic rejection"));
    render(<ProductModal businessId="business-1" open onClose={onClose} onSubmit={submit} initialData={product} />);
    const user = userEvent.setup(); await user.clear(input("sale-price")); await user.type(input("sale-price"), "1200");
    await user.click(screen.getByTestId("save-product-btn")); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled(); expect(input("sale-price")).toHaveValue(1200); expect(input("cost-tax")).toHaveValue(1190); expect(input("cost-price")).toHaveValue(1000);
  });
  it("does not bypass a failed cost calculation by editing the local suggestion", () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    fireEvent.change(input("cost-price"), { target: { value: "2147483647" } });
    fireEvent.change(input("suggested-markup"), { target: { value: "0" } });
    expect(input("cost-price")).toHaveValue(2147483647); expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    fireEvent.change(input("tax-rate"), { target: { value: "0" } });
    expect(input("cost-price")).toHaveValue(2147483647); expect(input("cost-tax")).toHaveValue(2147483647); expect(input("sale-price")).toHaveValue(1547); expect(screen.getByTestId("save-product-btn")).not.toBeDisabled();
  });
  it("repairs an invalid cost tax rate without overwriting a manually entered sale price", () => {
    render(<ProductModal businessId="business-1" open onClose={vi.fn()} onSubmit={submit} initialData={product} />);
    fireEvent.change(input("tax-rate"), { target: { value: "" } });
    fireEvent.change(input("sale-price"), { target: { value: "1200" } });
    expect(input("sale-price")).toHaveValue(1200); expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    fireEvent.change(input("tax-rate"), { target: { value: "10" } });
    expect(input("sale-price")).toHaveValue(1200); expect(input("cost-tax")).toHaveValue(1100); expect(input("cost-price")).toHaveValue(1000); expect(screen.getByTestId("save-product-btn")).not.toBeDisabled();
  });
  it("discards calculation errors and the local invalid rate only when explicitly reopening the editor", () => {
    const props = { businessId: "business-1", onClose: vi.fn(), onSubmit: submit, initialData: product };
    const { rerender } = render(<ProductModal {...props} open />);
    fireEvent.change(input("tax-rate"), { target: { value: "" } }); expect(screen.getByTestId("save-product-btn")).toBeDisabled();
    rerender(<ProductModal {...props} open={false} />);
    rerender(<ProductModal {...props} open />);
    expect(input("tax-rate")).toHaveValue(19); expect(input("cost-price")).toHaveValue(1000); expect(input("cost-tax")).toHaveValue(1190); expect(input("sale-price")).toHaveValue(1547); expect(screen.getByTestId("save-product-btn")).not.toBeDisabled();
  });
});
