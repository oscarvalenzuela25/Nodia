export const MAX_SALE_QUANTITY = 2147483647;
const MAX_MILLI = BigInt(MAX_SALE_QUANTITY) * 1000n;
export const DECIMAL_QUANTITY_PATTERN = /^(0|[1-9]\d*)(?:\.\d{1,3})?$/;

/** Three decimal places as integer thousandths, without binary money arithmetic. */
export const quantityThousandths = (value: unknown): bigint | null => {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value)
    : typeof value === "string" ? value.replace(",", ".") : "";
  if (raw.length > 14 || !DECIMAL_QUANTITY_PATTERN.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const scaled = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, "0"));
  return scaled <= MAX_MILLI ? scaled : null;
};
export const quantityFromInput = (raw: string): number | null => {
  const scaled = quantityThousandths(raw);
  return scaled === null ? null : Number(scaled) / 1000;
};
export const stepSaleQuantity = (quantity: number, delta: number): number => {
  const scaled = quantityThousandths(quantity);
  if (scaled === null || !Number.isSafeInteger(delta)) throw new Error("invalid_quantity");
  const next = scaled + BigInt(delta) * 1000n;
  if (next > MAX_MILLI) throw new Error("invalid_quantity");
  return Number(next < 0n ? 0n : next) / 1000;
};
export const lineSubtotal = (price: string, quantity: number): string => {
  const scaled = quantityThousandths(quantity);
  if (!/^(0|[1-9]\d*)$/.test(price) || scaled === null) throw new Error("invalid_cart");
  return String((BigInt(price) * scaled + 500n) / 1000n);
};
/** Format a decimal aggregate without converting a potentially large count to Number. */
export const formatQuantity = (value: string | number, language = "es"): string => {
  const raw = String(value);
  if (!DECIMAL_QUANTITY_PATTERN.test(raw)) return "—";
  const [whole, fraction = ""] = raw.split(".");
  const formatter = new Intl.NumberFormat(language.startsWith("en") ? "en-CL" : "es-CL");
  const decimal = formatter.formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const suffix = fraction.replace(/0+$/, "");
  return formatter.format(BigInt(whole)) + (suffix ? decimal + suffix : "");
};
