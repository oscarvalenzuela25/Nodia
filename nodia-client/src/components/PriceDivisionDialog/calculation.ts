import { roundSalePrice, SALE_PRICE_MAX } from "../../utils/salePrice";

export type PriceDivisionMode = "sale" | "net";

export function parseDivisionInput(value: string): number | null {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
  const number = Number(value.trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

/** Divide the real value first; sale prices round directly to tens, net to whole CLP. */
export function dividePrice(price: number | null, divisor: number | null, mode: PriceDivisionMode): number | null {
  if (price === null || divisor === null || !Number.isFinite(price) || !Number.isFinite(divisor)
    || price < 0 || price > SALE_PRICE_MAX || divisor <= 0) return null;
  const result = price / divisor;
  if (!Number.isFinite(result) || result < 0 || result > SALE_PRICE_MAX) return null;
  return mode === "sale" ? roundSalePrice(result) : Math.round(result);
}
