import { describe, expect, it } from "vitest";
import { saleSchema, summarySchema } from "../../../../modules/business/infrastructure/salesSchemas";
const fixture = { id: "sale", business_id: "business", status: "draft", currency: "CLP", payment_method: "cash", payment_method_description: null,
  total_amount: "0", version: 1, created_at: "2026-10-28T12:00:00Z", updated_at: "2026-10-28T12:00:00Z", completed_at: null, cancelled_at: null, cancellation_reason: null, items: [] };
describe("remote sales contract", () => {
  it("accepts an explicit manual snapshot without relaxing regular/offer price consistency", () => {
    const item = { id: "item", product_id: "product", position: 0, quantity: 1.125, product_code_snapshot: null,
      product_barcode_snapshot: null, product_name_snapshot: "Synthetic kilos", measurement_unit_snapshot: "kg",
      regular_unit_price: "10000", offer_price_snapshot: "9000", is_offer_enabled_snapshot: true, price_source: "manual",
      unit_price: "8000", line_total: "9000", product_version: 1 };
    const response = { ...fixture, total_amount: "9000", items: [item] };
    expect(saleSchema.parse(response).items[0].price_source).toBe("manual");
    expect(saleSchema.safeParse({ ...response, items: [{ ...item, price_source: "offer" }] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...response, items: [{ ...item, line_total: "8000" }] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...response, items: [{ ...item, is_offer_enabled_snapshot: true, offer_price_snapshot: null }] }).success).toBe(false);
  });
  it("accepts a real empty draft and rejects fabricated monetary defaults/noncanonical amounts", () => {
    expect(saleSchema.parse(fixture).total_amount).toBe("0");
    for (const total_amount of [undefined, null, 0, "", "01", "NaN"]) expect(saleSchema.safeParse({ ...fixture, total_amount }).success).toBe(false);
  });
  it("rejects inconsistent server totals and impossible completed empty sales", () => {
    expect(saleSchema.safeParse({ ...fixture, total_amount: "100" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...fixture, status: "completed" }).success).toBe(false);
  });
  it("validates fractional snapshot amounts by the per-line CLP rounding rule and keeps nullable commercial codes", () => {
    const item = { id: "item", product_id: "product", position: 0, quantity: 1.125, product_code_snapshot: null,
      product_barcode_snapshot: null, product_name_snapshot: "Synthetic kilos", measurement_unit_snapshot: "kg",
      regular_unit_price: "10000", offer_price_snapshot: null, is_offer_enabled_snapshot: false, price_source: "regular",
      unit_price: "10000", line_total: "11250", product_version: 1 };
    const response = { ...fixture, total_amount: "11250", items: [item] };
    expect(saleSchema.parse(response).items[0]).toMatchObject({ quantity: 1.125, measurement_unit_snapshot: "kg", product_code_snapshot: null });
    expect(saleSchema.safeParse({ ...response, items: [{ ...item, quantity: 1.1251 }] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...response, items: [{ ...item, line_total: "11249" }] }).success).toBe(false);
  });
  it("preserves no-sales zeros and null average while rejecting a different currency/timezone", () => {
    const summary = { currency: "CLP", timezone: "America/Santiago", sales_count: "0", total_amount: "0", units_sold: "0", average_ticket: null };
    expect(summarySchema.parse(summary)).toEqual(summary);
    expect(summarySchema.safeParse({ ...summary, currency: "USD" }).success).toBe(false);
    expect(summarySchema.safeParse({ ...summary, timezone: "UTC" }).success).toBe(false);
  });
});
