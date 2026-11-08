import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SaleLineList from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/SaleLineList";
import type { CartLine } from "../../../../../../../../modules/business/infrastructure/salesTypes";
import { useState } from "react";
import { quantityFromInput, removeCartProduct, setCartQuantity } from "../../../../../../../../modules/business/infrastructure/salesPolicies";
import { useSalePriceEditing } from "../../../../../../../../modules/business/infrastructure/useSalePriceEditing";

const line: CartLine = { product_id: "1", name: "Selected synthetic product", code: "HIDDEN-INVOICE", barcode: "000999", quantity: 2, expected_product_version: 1, expected_unit_price: "2000", regular_price: "1500", offer_price: "2000", price_source: "offer" };
const defaults = { lines: [line], images: {}, disabled: false, imageLoading: false, imageError: false, imageFetching: false, retryImages: vi.fn(), quantityDrafts: {}, onStep: vi.fn(), onQuantity: vi.fn() };
describe("SaleLineList", () => {
  it("locks quantities, removal, review and other prices until the active editor saves or cancels", async () => {
    const onPrice = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    function Harness() {
      const editor = useSalePriceEditing("sale-1");
      return <SaleLineList {...defaults} lines={[line, { ...line, product_id: "2", name: "Second product" }]}
        disabled={editor.editingProductId !== null} priceDisabled={false}
        editingProductId={editor.editingProductId} onPriceEditingChange={editor.onEditingChange}
        onPrice={onPrice} onRemove={vi.fn()} onReview={vi.fn()} />;
    }
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Editar precio Selected synthetic product" }));
    expect(screen.getByRole("textbox", { name: "Precio CLP" })).toBeEnabled();
    for (const quantity of screen.getAllByRole("textbox", { name: "Cantidad" })) expect(quantity).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar precio Second product" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Revisar precios vigentes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar Selected synthetic product de esta venta" })).toBeDisabled();
    await user.clear(screen.getByRole("textbox", { name: "Precio CLP" }));
    await user.type(screen.getByRole("textbox", { name: "Precio CLP" }), "800");
    await user.click(screen.getByRole("button", { name: "Modificar sólo para esta venta" }));
    expect(screen.getByRole("textbox", { name: "Precio CLP" })).toHaveValue("800");
    expect(screen.getByRole("button", { name: "Editar precio Second product" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    for (const quantity of screen.getAllByRole("textbox", { name: "Cantidad" })) expect(quantity).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Editar precio Second product" }));
    await user.click(screen.getByRole("button", { name: "Modificar sólo para esta venta" }));
    expect(screen.queryByRole("textbox", { name: "Precio CLP" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar precios vigentes" })).toBeEnabled();
  });
  it("retains a zero row until the explicit trash action and enlarges text without changing its price", async () => {
    function Harness() {
      const [lines, setLines] = useState<CartLine[]>([{ ...line, measurement_unit: "kg", quantity: 1.125 }]);
      const [scale, setScale] = useState(100);
      return <SaleLineList {...defaults} lines={lines} fontScale={scale} onFontScale={setScale}
        onQuantity={(id, raw) => { const quantity = quantityFromInput(raw); if (quantity !== null) setLines((old) => setCartQuantity(old, id, quantity)); }}
        onRemove={(id) => setLines((old) => removeCartProduct(old, id))} />;
    }
    render(<Harness />);
    const region = screen.getByRole("region", { name: "Productos de la venta" });
    expect(region).toHaveTextContent("$2.000 x kilo");
    expect(region).toHaveTextContent("Subtotal: $2.250");
    await userEvent.click(screen.getByRole("button", { name: "Aumentar tamaño de la lista" }));
    expect(screen.getByText("110%")).toBeInTheDocument();
    expect(getComputedStyle(region).getPropertyValue("--sale-font-scale")).toBe("1.1");
    expect(region).toHaveTextContent("Subtotal: $2.250");
    fireEvent.change(within(region).getByRole("textbox", { name: "Cantidad" }), { target: { value: "0" } });
    expect(within(region).getAllByRole("listitem")).toHaveLength(1);
    expect(region).toHaveTextContent("Subtotal: $0");
    await userEvent.click(within(region).getByRole("button", { name: "Quitar Selected synthetic product de esta venta" }));
    expect(within(region).queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("shows an explicit empty sale without displaying catalogue products or quantity controls", () => {
    const { rerender } = render(<SaleLineList {...defaults} lines={[]} />);
    const region = screen.getByRole("region", { name: "Productos de la venta" });
    expect(within(region).getByRole("heading", { name: "Agrega el primer producto" })).toBeInTheDocument();
    expect(region).toHaveTextContent("Escanea su código de barras o búscalo por nombre para comenzar.");
    expect(within(region).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(region).queryByRole("button")).not.toBeInTheDocument();
    rerender(<SaleLineList {...defaults} />);
    expect(within(region).queryByRole("heading", { name: "Agrega el primer producto" })).not.toBeInTheDocument();
    expect(within(region).getAllByRole("listitem")).toHaveLength(1);
  });
  it("renders each selected product once, with frozen offer price, exact subtotal and only the quantity actions", async () => {
    const onStep = vi.fn(), onQuantity = vi.fn();
    render(<SaleLineList {...defaults} onStep={onStep} onQuantity={onQuantity} />);
    const region = screen.getByRole("region", { name: "Productos de la venta" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(1);
    expect(within(region).getByText("Selected synthetic product", { selector: "p" })).toBeInTheDocument();
    expect(within(region).queryByText(/HIDDEN-INVOICE|000999/)).not.toBeInTheDocument();
    expect(within(region).getByText("Subtotal: $4.000")).toBeInTheDocument();
    expect(within(region).getAllByRole("button")).toHaveLength(2);
    await userEvent.click(within(region).getByRole("button", { name: /Aumentar/ }));
    expect(onStep).toHaveBeenCalledExactlyOnceWith("1", 1);
    const input = within(region).getByRole("textbox", { name: "Cantidad" });
    fireEvent.change(input, { target: { value: "" } }); expect(onQuantity).toHaveBeenLastCalledWith("1", "");
    fireEvent.change(input, { target: { value: "0" } }); expect(onQuantity).toHaveBeenLastCalledWith("1", "0");
  });
  it("keeps lines and quantities available after an image error, with an explicit local retry", async () => {
    const retryImages = vi.fn(); render(<SaleLineList {...defaults} imageError retryImages={retryImages} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Cantidad" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(retryImages).toHaveBeenCalledTimes(1);
  });
  it("keeps review and text-size actions keyboard accessible with their existing limits", async () => {
    const onReview = vi.fn(), onFontScale = vi.fn();
    const { rerender } = render(<SaleLineList {...defaults} onReview={onReview} onFontScale={onFontScale} fontScale={200} />);
    const increase = screen.getByRole("button", { name: "Aumentar tamaño de la lista" });
    const decrease = screen.getByRole("button", { name: "Reducir tamaño de la lista" });
    expect(increase).toBeDisabled();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Revisar precios vigentes" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onReview).toHaveBeenCalledTimes(1);
    decrease.focus(); await user.keyboard("{Enter}");
    expect(onFontScale).toHaveBeenLastCalledWith(190);
    rerender(<SaleLineList {...defaults} disabled onReview={onReview} onFontScale={onFontScale} fontScale={80} />);
    expect(screen.getByRole("button", { name: "Revisar precios vigentes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reducir tamaño de la lista" })).toBeDisabled();
  });
});
