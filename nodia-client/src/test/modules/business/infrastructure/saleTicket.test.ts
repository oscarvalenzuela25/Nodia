import { describe, expect, it } from "vitest";
import i18n from "../../../../translate";
import { buildCartTicket, buildSavedSaleTicket } from "../../../../modules/business/infrastructure/saleTicket";
import type { CartLine, Sale, SaleItem } from "../../../../modules/business/infrastructure/salesTypes";

const cartLine = (attributes: Partial<CartLine> = {}): CartLine => ({
  product_id: "synthetic-product", quantity: 1.125, expected_product_version: 1, expected_unit_price: "10000",
  name: "Synthetic kilos", code: null, barcode: null, regular_price: "10000", offer_price: null, price_source: "regular", measurement_unit: "kg", ...attributes,
});
const item = (attributes: Partial<SaleItem> = {}): SaleItem => ({
  id: "synthetic-item", product_id: "synthetic-product", position: 0, quantity: 1.125, product_code_snapshot: null,
  product_barcode_snapshot: null, product_name_snapshot: "Frozen kilos", measurement_unit_snapshot: "kg", regular_unit_price: "10000",
  offer_price_snapshot: null, is_offer_enabled_snapshot: false, price_source: "regular", unit_price: "10000", line_total: "11250", product_version: 1, ...attributes,
});
const saved = (attributes: Partial<Sale> = {}): Sale => ({
  id: "synthetic-sale", business_id: "synthetic-business", status: "completed", currency: "CLP", payment_method: "cash", payment_method_description: null,
  total_amount: "11250", version: 1, created_at: "2026-07-01T02:00:00Z", updated_at: "2026-07-01T02:30:00Z", completed_at: "2026-07-01T02:30:00Z",
  cancelled_at: null, cancellation_reason: null, items: [item()], ...attributes,
});

describe("ticket snapshots", () => {
  it("omits zero rows without modifying a cart or inventing sale identity/date", () => {
    const lines = [cartLine(), cartLine({ product_id: "zero", name: "Do not print", quantity: 0 })];
    const before = structuredClone(lines);
    const ticket = buildCartTicket({ businessName: "  Synthetic business  ", lines, paymentMethod: "cash", language: "es" });
    expect(ticket).toMatchObject({ businessName: "Synthetic business", saleId: null, issuedAt: null, total: "$11.250", paymentMethod: "Efectivo" });
    expect(ticket.lines).toEqual([{ name: "Synthetic kilos", quantity: "1,125", unitPrice: "$10.000 x kilo", subtotal: "$11.250" }]);
    expect(lines).toEqual(before);
    expect(buildCartTicket({ lines: [cartLine({ quantity: 0 })], paymentMethod: "cash", language: "es" }).lines).toEqual([]);
  });

  it("rounds HALF_UP per line, preserves free lines and formats money beyond Number precision", () => {
    const ticket = buildCartTicket({ lines: [cartLine({ quantity: 0.001, expected_unit_price: "1500" }), cartLine({ product_id: "free", expected_unit_price: "0", quantity: 2 })], paymentMethod: "debit_card", language: "es" });
    expect(ticket.lines.map((line) => line.subtotal)).toEqual(["$2", "$0"]);
    expect(ticket.total).toBe("$2");
    const big = buildCartTicket({ lines: [cartLine({ quantity: 1, expected_unit_price: "9007199254740993" })], paymentMethod: "cash", language: "es" });
    expect(big.total).toBe("$9.007.199.254.740.993");
    expect(big.lines[0].subtotal).toBe(big.total);
  });

  it("omits every product detail from a cart voucher while preserving the validated total and header", () => {
    const input = { businessName: "Synthetic business", lines: [cartLine(), cartLine({ product_id: "zero", quantity: 0 })], paymentMethod: "cash" as const, description: "Synthetic detail", language: "es" };
    const before = structuredClone(input);
    const detailed = buildCartTicket(input);
    const voucher = buildCartTicket({ ...input, showDetails: false });
    expect(voucher).toEqual({ ...detailed, lines: [] });
    expect(voucher.total).toBe("$11.250");
    expect(JSON.stringify(voucher)).not.toContain("Synthetic kilos");
    expect(JSON.stringify(voucher)).not.toContain("1,125");
    expect(JSON.stringify(voucher)).not.toContain("$10.000");
    expect(input).toEqual(before);
    expect(() => buildCartTicket({ ...input, lines: [cartLine({ quantity: 0.0001 })], showDetails: false })).toThrow();
    expect(() => buildCartTicket({ ...input, lines: [cartLine({ expected_unit_price: "1.5" })], showDetails: false })).toThrow();
    expect(() => buildCartTicket({ ...input, lines: [cartLine({ name: null as never })], showDetails: false })).toThrow();
    expect(() => buildCartTicket({ ...input, lines: [cartLine({ measurement_unit: "mg" as never })], showDetails: false })).toThrow();
  });

  it("uses the explicitly requested language and optional payment detail", async () => {
    await i18n.changeLanguage("en");
    const spanish = buildCartTicket({ lines: [cartLine()], paymentMethod: "other", description: "  Synthetic voucher  ", language: "es" });
    expect(spanish.paymentMethod).toBe("Otro (Synthetic voucher)");
    expect(spanish.lines[0].unitPrice).toBe("$10.000 x kilo");
    expect(buildCartTicket({ lines: [], paymentMethod: "credit_card", language: "en" }).paymentMethod).toBe("Credit card");
  });

  it("rejects malformed quantities, prices and units instead of printing fabricated defaults", () => {
    for (const quantity of [-1, 0.0001, NaN, Infinity]) expect(() => buildCartTicket({ lines: [cartLine({ quantity })], paymentMethod: "cash", language: "es" })).toThrow();
    for (const expected_unit_price of ["", "01", "NaN", "1.5"]) expect(() => buildCartTicket({ lines: [cartLine({ expected_unit_price })], paymentMethod: "cash", language: "es" })).toThrow();
    expect(() => buildCartTicket({ lines: [cartLine({ measurement_unit: "mg" as never })], paymentMethod: "cash", language: "es" })).toThrow();
  });

  it("orders confirmed frozen items and formats the confirmation instant in Santiago", () => {
    const sale = saved({ total_amount: "12250", items: [item({ position: 1 }), item({ id: "other", product_id: "other", position: 0, product_name_snapshot: "First frozen", quantity: 1, unit_price: "1000", regular_unit_price: "1000", line_total: "1000" })] });
    const before = structuredClone(sale);
    const ticket = buildSavedSaleTicket({ sale, language: "es" });
    expect(ticket.saleId).toBe(sale.id);
    expect(ticket.businessName).toBeNull();
    expect(ticket.lines.map((line) => line.name)).toEqual(["First frozen", "Frozen kilos"]);
    expect(ticket.issuedAt).toMatch(/30.*06.*2026/);
    expect(ticket.issuedAt).toContain("22:30:00");
    expect(ticket.issuedAt).toContain("America/Santiago");
    expect(sale).toEqual(before);
  });

  it("reprints selected offer snapshots and the documented omitted-unit legacy default", () => {
    const sale = saved({ total_amount: "500", items: [item({ quantity: 1, measurement_unit_snapshot: undefined, regular_unit_price: "1000", offer_price_snapshot: "500", is_offer_enabled_snapshot: true, price_source: "offer", unit_price: "500", line_total: "500" })] });
    const ticket = buildSavedSaleTicket({ sale, language: "es" });
    expect(ticket.lines[0]).toMatchObject({ unitPrice: "$500 x unidad", subtotal: "$500" });
    expect(ticket.total).toBe("$500");
  });

  it("omits saved product details from a voucher without changing its frozen identity, date, total or payment", () => {
    const sale = saved();
    const before = structuredClone(sale);
    const input = { businessName: "Synthetic business", sale, language: "es" };
    const detailed = buildSavedSaleTicket(input);
    const voucher = buildSavedSaleTicket({ ...input, showDetails: false });
    expect(voucher).toEqual({ ...detailed, lines: [] });
    expect(voucher.total).toBe("$11.250");
    expect(JSON.stringify(voucher)).not.toContain("Frozen kilos");
    expect(JSON.stringify(voucher)).not.toContain("1,125");
    expect(JSON.stringify(voucher)).not.toContain("$10.000");
    expect(sale).toEqual(before);
    expect(() => buildSavedSaleTicket({ ...input, sale: saved({ total_amount: "11249" }), showDetails: false })).toThrow();
    expect(() => buildSavedSaleTicket({ ...input, sale: saved({ items: [item({ unit_price: "9999" })] }), showDetails: false })).toThrow();
    expect(() => buildSavedSaleTicket({ ...input, sale: saved({ status: "cancelled" }), showDetails: false })).toThrow();
    expect(() => buildSavedSaleTicket({ ...input, sale: saved({ completed_at: null }), showDetails: false })).toThrow();
  });

  it("refuses unconfirmed/cancelled sales and inconsistent or ambiguous saved snapshots", () => {
    for (const status of ["draft", "cancelled", "discarded"] as const) expect(() => buildSavedSaleTicket({ sale: saved({ status }), language: "es" })).toThrow();
    expect(() => buildSavedSaleTicket({ sale: saved({ completed_at: null }), language: "es" })).toThrow("ticket_sale_not_completed");
    expect(() => buildSavedSaleTicket({ sale: saved({ total_amount: "11249" }), language: "es" })).toThrow();
    expect(() => buildSavedSaleTicket({ sale: saved({ items: [item({ unit_price: "9999" })] }), language: "es" })).toThrow();
    expect(() => buildSavedSaleTicket({ sale: saved({ total_amount: "22500", items: [item(), item({ id: "second", product_id: "second" })] }), language: "es" })).toThrow("invalid_ticket");
  });
});
