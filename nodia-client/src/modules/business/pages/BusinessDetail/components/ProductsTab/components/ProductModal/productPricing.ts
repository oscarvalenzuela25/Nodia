export const PRODUCT_PRICE_MAX = 2147483647;

export interface ProductPricingValues {
  cost_price: number;
  cost_price_tax: number;
  sale_price: number;
}
export type ProductPricingField = keyof ProductPricingValues | "tax_rate";
export type ProductPricingResult = { valid: true; values: Partial<ProductPricingValues> } | { valid: false };

const integer = (value: number) => Number.isInteger(value) && value >= 0 && value <= PRODUCT_PRICE_MAX;
export const validProductTaxRate = (value: number) => Number.isFinite(value) && value >= 0;

/** UI assistance only: Product stores these integers independently, without a fiscal calculation. */
export function calculateProductPricing(source: ProductPricingField, value: number, current: ProductPricingValues, taxRate: number): ProductPricingResult {
  const tax = source === "tax_rate" ? value : taxRate;
  // Regular sale price is independent of cost and the local suggestion.
  if (source === "sale_price") return integer(value) ? { valid: true, values: {} } : { valid: false };
  if (!validProductTaxRate(tax) || (source !== "tax_rate" && !integer(value))) return { valid: false };
  const taxFactor = 1 + tax / 100;
  let values: Partial<ProductPricingValues>;
  if (source === "cost_price_tax") {
    values = { cost_price: Math.round(value / taxFactor) };
  } else {
    const baseCost = source === "cost_price" ? value : current.cost_price;
    if (!integer(baseCost)) return { valid: false };
    const costWithTax = Math.round(baseCost * taxFactor);
    values = { cost_price_tax: costWithTax };
  }
  // Never clamp or silently keep valid-looking stale derivatives after an overflow.
  return Object.values(values).every(integer) ? { valid: true, values } : { valid: false };
}

/** Local assistance only; the editable markup is never part of a product payload. */
export function suggestedProductPrice(costPriceTax: number | null, markup: number): number | null {
  if (costPriceTax === null || !integer(costPriceTax) || !Number.isFinite(markup) || markup < 0) return null;
  const price = Math.round(costPriceTax * (1 + markup / 100));
  return integer(price) ? price : null;
}
