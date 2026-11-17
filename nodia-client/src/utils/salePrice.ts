export const SALE_PRICE_MAX = 2147483647;

/** CLP sale prices use nearest tens, with ties upward. Invalid/overflow stays invalid. */
export function roundSalePrice(value: number): number | null {
  if (!Number.isFinite(value) || value < 0 || value > SALE_PRICE_MAX) return null;
  const rounded = Math.round(value / 10) * 10;
  return rounded <= SALE_PRICE_MAX ? rounded : null;
}
