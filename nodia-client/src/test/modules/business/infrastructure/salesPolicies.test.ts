import { describe, expect, it } from "vitest";
import { addCartProduct, averageClp, barcodeValue, cartTotal, moneyInteger, productToCartLine, quantityFromInput, refreshCartPrices, saleToCart, setCartQuantity, removeCartProduct, setCartUnitPrice, cartLinePrice } from "../../../../modules/business/infrastructure/salesPolicies";
import { salesPeriod } from "../../../../modules/business/infrastructure/salesDates";
import type { ProductEntity } from "../../../../modules/business/infrastructure/types";
import type { Sale } from "../../../../modules/business/infrastructure/salesTypes";

const product: ProductEntity = { id: "90071992547409930", business_id: "business", code: "SUP-01", barcode: "001234",
  name: "Synthetic product", cost_price: 0, cost_price_tax: 0, sale_price: 1000,
  offer_price: 1500, is_offer_enabled: false, effective_price: "1000", price_source: "regular", has_stock: true, stock: 0, is_active: true, version: 2 };
describe("POS policies", () => {
  it("keeps a sale-only price across rescans and catalog review without overwriting observed prices", async () => {
    const original = productToCartLine(product);
    const changed = setCartUnitPrice([original], product.id, "250");
    expect(original.unit_price_override).toBeUndefined();
    expect(changed[0].expected_unit_price).toBe("1000");
    expect(cartTotal(changed)).toBe("250");
    expect(cartTotal(addCartProduct(changed, product))).toBe("500");
    const reviewed = await refreshCartPrices("business", changed, async () => [{ ...product, version: 3, sale_price: 1100, effective_price: "1100" }]);
    expect(reviewed[0]).toMatchObject({ expected_unit_price: "1100", expected_product_version: 3, unit_price_override: "250" });
    expect(cartLinePrice(reviewed[0])).toBe("250");
    expect(cartTotal(setCartUnitPrice([original], product.id, "0"))).toBe("0");
    for (const price of ["", "-1", "1.5", "01", "9223372036854775808"]) expect(() => setCartUnitPrice([original], product.id, price)).toThrow();
  });
  it("keeps barcode text and rejects outer whitespace/controls without interpreting supplier codes", () => {
    expect(barcodeValue("001234\r\n")).toBe("001234");
    for (const value of ["", "  ", " 001234", "001234 ", "00\t12"]) expect(() => barcodeValue(value)).toThrow();
  });
  it("counts consecutive scans of the same product and refuses to mix price revisions", () => {
    const once = addCartProduct([], product);
    expect(addCartProduct(once, product)[0].quantity).toBe(2);
    expect(() => addCartProduct(once, { ...product, version: 3 })).toThrow("price_changed");
  });
  it("retains a zero row and removes only the explicitly selected product", () => {
    const lines = [productToCartLine(product), { ...productToCartLine(product), product_id: "second", quantity: 3 }];
    const increased = setCartQuantity(lines, product.id, 2);
    expect(increased.map((line) => line.quantity)).toEqual([2, 3]);
    expect(cartTotal(increased)).toBe("5000");
    const zero = setCartQuantity(increased, product.id, 0);
    expect(zero.map((line) => line.quantity)).toEqual([0, 3]);
    expect(removeCartProduct(zero, product.id)).toEqual([lines[1]]);
    expect(lines[0].quantity).toBe(1);
    expect(setCartQuantity(lines, "removed", 0)).toBe(lines);
  });
  it("rejects invalid quantities and overflowing totals without altering the cart", () => {
    const lines = [{ ...productToCartLine(product), expected_unit_price: "9223372036854775807" }];
    for (const quantity of [-1, .0001, 2147483648, NaN]) expect(() => setCartQuantity(lines, product.id, quantity)).toThrow("invalid_cart");
    expect(() => setCartQuantity(lines, product.id, 2)).toThrow("cart_overflow");
    expect(lines[0].quantity).toBe(1);
  });
  it("uses the configured alternate price even when it is higher and never falls back for a missing selected price", () => {
    expect(productToCartLine({ ...product, is_offer_enabled: true, effective_price: "1500", price_source: "offer" }).expected_unit_price).toBe("1500");
    expect(productToCartLine(product).expected_unit_price).toBe("1000");
    expect(() => productToCartLine({ ...product, is_offer_enabled: true, offer_price: null })).toThrow();
    expect(() => productToCartLine({ ...product, has_stock: null })).toThrow();
  });
  it("preserves real zero and exact totals above Number precision and rejects overflow/invalid quantities", () => {
    expect(moneyInteger("")).toBeNull(); expect(moneyInteger(null)).toBeNull(); expect(moneyInteger("0")).toBe("0");
    const line = { ...productToCartLine(product), quantity: 10, expected_unit_price: "9007199254740993" };
    expect(cartTotal([line])).toBe("90071992547409930");
    expect(cartTotal([])).toBe("0");
    expect(cartTotal([{ ...line, quantity: 0 }])).toBe("0");
    expect(() => cartTotal([{ ...line, expected_unit_price: "9223372036854775807" }])).toThrow("cart_overflow");
  });
  it("reads confirmed snapshots without recalculating from the current catalog", () => {
    const sale = { items: [{ product_id: product.id, quantity: 2, product_version: 1, unit_price: "500", product_name_snapshot: "Old name", product_code_snapshot: "OLD", product_barcode_snapshot: null, regular_unit_price: "1000", offer_price_snapshot: "500", price_source: "offer" }] } as Sale;
    expect(saleToCart(sale)[0]).toMatchObject({ name: "Old name", expected_unit_price: "500", quantity: 2 });
  });
  it("rounds only the displayed average and keeps empty populations unknown", () => {
    expect(averageClp({ numerator: "5", denominator: "2" })).toBe("3");
    expect(averageClp({ numerator: "0", denominator: "0" })).toBeNull();
  });
  it("enforces the contracted line/quantity bounds without rounding invalid input", () => {
    expect(quantityFromInput("2147483647")).toBe(2147483647);
    expect(quantityFromInput("0")).toBe(0);
    expect(quantityFromInput("1,125")).toBe(1.125);
    for (const value of ["", "0.0001", "1.2345", "2147483648", "1e2"]) expect(quantityFromInput(value)).toBeNull();
    const lines = Array.from({ length: 200 }, (_, index) => ({ ...productToCartLine(product), product_id: String(index) }));
    expect(() => addCartProduct(lines, product)).toThrow("cart_limit");
  });
  it("refreshes 200 products in two bounded requests and keeps original order and quantities", async () => {
    const products = Array.from({ length: 200 }, (_, index) => ({ ...product, id: String(index) }));
    const lines = products.map((item) => ({ ...productToCartLine(item), quantity: 2 }));
    const requests: string[][] = [];
    const refreshed = await refreshCartPrices("business", lines, async (ids) => { requests.push(ids); return products.filter((item) => ids.includes(item.id)).reverse(); });
    expect(requests.map((ids) => ids.length)).toEqual([100, 100]);
    expect(refreshed.map((line) => line.product_id)).toEqual(lines.map((line) => line.product_id));
    expect(refreshed[199].quantity).toBe(2);
    await expect(refreshCartPrices("business", lines, async () => [])).rejects.toThrow("unavailable_product");
    expect(lines[0].expected_unit_price).toBe("1000");
  });
  it("does not reinterpret an existing cart quantity after the product unit changes", async () => {
    const lines = [{ ...productToCartLine({ ...product, measurement_unit: "kg" }), quantity: 1.125 }];
    await expect(refreshCartPrices("business", lines, async () => [{ ...product, measurement_unit: "g", version: 3 }])).rejects.toThrow("unit_changed");
    expect(lines[0]).toMatchObject({ quantity: 1.125, measurement_unit: "kg", expected_unit_price: "1000" });
  });
});
describe("sales periods in America/Santiago", () => {
  it("uses local civil day boundaries through the DST transition", () => {
    const period = salesPeriod("2026-09-06", "2026-09-06");
    expect(period.from).toBe("2026-09-06T04:00:00Z");
    expect(period.to_exclusive).toBe("2026-09-07T03:00:00Z");
  });
  it("rejects inverted and invalid dates rather than replacing them with today", () => {
    expect(() => salesPeriod("2026-10-29", "2026-10-28")).toThrow();
    expect(() => salesPeriod("", "2026-10-28")).toThrow();
  });
});
