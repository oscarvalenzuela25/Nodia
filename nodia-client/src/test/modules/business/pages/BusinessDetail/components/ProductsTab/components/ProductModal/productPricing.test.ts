import { describe, expect, it } from "vitest";
import { calculateProductPricing, PRODUCT_PRICE_MAX, suggestedProductPrice, validProductTaxRate } from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductModal/productPricing";

const current = { cost_price: 1000, cost_price_tax: 1190, sale_price: 1547 };

describe("independent product price and cost assistance", () => {
  it.each([
    ["cost_price", 1000, { cost_price_tax: 1190 }],
    ["cost_price_tax", 1190, { cost_price: 1000 }],
    ["tax_rate", 10, { cost_price_tax: 1100 }],
    ["sale_price", 1200, {}],
    ["sale_price", 0, {}],
  ] as const)("links only costs for %s, preserving the manual sale price", (source, value, expected) => {
    expect(calculateProductPricing(source, value, current, 19)).toEqual({ valid: true, values: expected });
    expect(current).toEqual({ cost_price: 1000, cost_price_tax: 1190, sale_price: 1547 });
  });
  it("preserves zero costs and fractional local tax without deriving a sale price", () => {
    expect(calculateProductPricing("cost_price", 0, current, 19)).toEqual({ valid: true, values: { cost_price_tax: 0 } });
    expect(calculateProductPricing("cost_price_tax", 0, current, 19)).toEqual({ valid: true, values: { cost_price: 0 } });
    expect(calculateProductPricing("cost_price", 1000, current, 19.5)).toEqual({ valid: true, values: { cost_price_tax: 1195 } });
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, PRODUCT_PRICE_MAX + 1])("rejects invalid stored money %s without a guessed patch", (value) => {
    for (const source of ["sale_price", "cost_price", "cost_price_tax"] as const) expect(calculateProductPricing(source, value, current, 19)).toEqual({ valid: false });
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])("rejects invalid tax %s while keeping sale price independent", (tax) => {
    expect(validProductTaxRate(tax)).toBe(false);
    expect(calculateProductPricing("tax_rate", tax, current, 19)).toEqual({ valid: false });
    expect(calculateProductPricing("sale_price", 1200, current, tax)).toEqual({ valid: true, values: {} });
  });
  it("blocks missing cost dependencies and derived overflow without clamping", () => {
    expect(calculateProductPricing("tax_rate", 19, { ...current, cost_price: Number.NaN }, 19)).toEqual({ valid: false });
    expect(calculateProductPricing("cost_price", PRODUCT_PRICE_MAX, current, 19)).toEqual({ valid: false });
    expect(calculateProductPricing("cost_price_tax", PRODUCT_PRICE_MAX, current, 19)).toEqual({ valid: true, values: { cost_price: Math.round(PRODUCT_PRICE_MAX / 1.19) } });
  });
});

describe("local suggested price", () => {
  it("uses gross cost and explicit editable markup with whole-CLP rounding", () => {
    expect(suggestedProductPrice(1190, 30)).toBe(1547);
    expect(suggestedProductPrice(1190, 2.5)).toBe(1220);
    expect(suggestedProductPrice(1, 50)).toBe(2);
    expect(suggestedProductPrice(0, 30)).toBe(0);
    expect(suggestedProductPrice(1190, 0)).toBe(1190);
  });
  it.each([null, Number.NaN, -1, 1.5, PRODUCT_PRICE_MAX + 1])("rejects missing or invalid gross cost %s", (cost) => {
    expect(suggestedProductPrice(cost, 30)).toBeNull();
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])("rejects invalid markup %s", (markup) => {
    expect(suggestedProductPrice(1190, markup)).toBeNull();
  });
  it("does not clamp an overflowing suggestion or invent a percentage ceiling", () => {
    expect(suggestedProductPrice(PRODUCT_PRICE_MAX, 30)).toBeNull();
    expect(suggestedProductPrice(1, 1000)).toBe(11);
    expect(suggestedProductPrice(PRODUCT_PRICE_MAX, 0)).toBe(PRODUCT_PRICE_MAX);
  });
});
