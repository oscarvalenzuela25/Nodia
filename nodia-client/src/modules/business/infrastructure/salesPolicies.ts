import type { ProductEntity } from "./types";
import type { CartLine, Sale } from "./salesTypes";
import { measurementUnit } from "./measurementUnits";
import { lineSubtotal, quantityThousandths, stepSaleQuantity } from "./saleQuantities";
export { MAX_SALE_QUANTITY, quantityFromInput } from "./saleQuantities";

const MAX_TOTAL = 9223372036854775807n;
export const MAX_SALE_LINES = 200;
export const moneyInteger = (value: unknown): string | null => {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) ? value : null;
};
export const formatClp = (value: string | number, language = "es") => {
  const canonical = moneyInteger(value);
  return canonical === null ? "—" : new Intl.NumberFormat(language.startsWith("en") ? "en-CL" : "es-CL", {
    style: "currency", currency: "CLP", maximumFractionDigits: 0,
  }).format(BigInt(canonical));
};
/** The observed catalog price remains separate from the explicit price for this sale. */
export const cartLinePrice = (line: Pick<CartLine, "expected_unit_price" | "unit_price_override">): string => {
  const observed = moneyInteger(line.expected_unit_price);
  const selected = line.unit_price_override == null ? observed : moneyInteger(line.unit_price_override);
  if (observed === null || selected === null || BigInt(observed) > MAX_TOTAL || BigInt(selected) > MAX_TOTAL) throw new Error("invalid_cart");
  return selected;
};
export const cartTotal = (lines: CartLine[]): string => {
  if (lines.length > MAX_SALE_LINES) throw new Error("cart_limit");
  const total = lines.reduce((sum, line) => {
    if (quantityThousandths(line.quantity) === null) throw new Error("invalid_cart");
    return sum + BigInt(lineSubtotal(cartLinePrice(line), line.quantity));
  }, 0n);
  if (total > MAX_TOTAL) throw new Error("cart_overflow");
  return String(total);
};
export const productToCartLine = (product: ProductEntity): CartLine => {
  const regular = moneyInteger(product.sale_price);
  const alternate = moneyInteger(product.offer_price);
  const selected = product.is_offer_enabled ? alternate : regular;
  const reported = moneyInteger(product.effective_price);
  if (!product.is_active || product.has_stock !== true || typeof product.is_offer_enabled !== "boolean" || !Number.isSafeInteger(product.version) || !product.version || selected === null || regular === null || reported !== selected || product.price_source !== (product.is_offer_enabled ? "offer" : "regular")) throw new Error("unavailable_product");
  return { product_id: product.id, quantity: 1, expected_product_version: product.version,
    expected_unit_price: selected, name: product.name, code: product.code, barcode: product.barcode ?? null,
    regular_price: regular, offer_price: alternate, price_source: product.is_offer_enabled ? "offer" : "regular", measurement_unit: measurementUnit(product.measurement_unit) };
};
export const addCartProduct = (lines: CartLine[], product: ProductEntity): CartLine[] => {
  const incoming = productToCartLine(product);
  const found = lines.find((line) => line.product_id === incoming.product_id);
  if (found && (found.expected_product_version !== incoming.expected_product_version || found.expected_unit_price !== incoming.expected_unit_price || measurementUnit(found.measurement_unit) !== incoming.measurement_unit)) throw new Error("price_changed");
  const result = found ? lines.map((line) => line === found ? { ...line, quantity: stepSaleQuantity(line.quantity, 1) } : line) : [...lines, incoming];
  cartTotal(result);
  return result;
};
export const setCartQuantity = (lines: CartLine[], productId: string, quantity: number): CartLine[] => {
  if (quantityThousandths(quantity) === null) throw new Error("invalid_cart");
  if (!lines.some((line) => line.product_id === productId)) return lines;
  const result = lines.map((line) => line.product_id === productId ? { ...line, quantity } : line);
  cartTotal(result);
  return result;
};
export const removeCartProduct = (lines: CartLine[], productId: string): CartLine[] => lines.filter((line) => line.product_id !== productId);
export const setCartUnitPrice = (lines: CartLine[], productId: string, price: string): CartLine[] => {
  const result = lines.map((line) => line.product_id === productId ? { ...line, unit_price_override: price } : line);
  cartTotal(result);
  return result;
};
export const saleToCart = (sale: Sale): CartLine[] => sale.items.map((item) => ({ product_id: item.product_id,
  quantity: item.quantity, expected_product_version: item.product_version, expected_unit_price: item.price_source === "manual" ? (item.is_offer_enabled_snapshot ? item.offer_price_snapshot! : item.regular_unit_price) : item.unit_price,
  ...(item.price_source === "manual" ? { unit_price_override: item.unit_price } : {}),
  name: item.product_name_snapshot, code: item.product_code_snapshot, barcode: item.product_barcode_snapshot,
  regular_price: item.regular_unit_price, offer_price: item.offer_price_snapshot, price_source: item.price_source === "manual" ? (item.is_offer_enabled_snapshot ? "offer" : "regular") : item.price_source, measurement_unit: measurementUnit(item.measurement_unit_snapshot) }));
export const barcodeValue = (value: string) => {
  const barcode = value.replace(/[\r\n]+$/, "");
  if (!barcode || barcode.length > 255 || barcode.trim() !== barcode || Array.from(barcode).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error("invalid_barcode");
  return barcode;
};
export const averageClp = (ratio: { numerator: string; denominator: string } | null): string | null => {
  if (!ratio || moneyInteger(ratio.numerator) === null || moneyInteger(ratio.denominator) === null || BigInt(ratio.denominator) === 0n) return null;
  const numerator = BigInt(ratio.numerator), denominator = BigInt(ratio.denominator);
  return String((numerator * 2n + denominator) / (denominator * 2n));
};
export const refreshCartPrices = async (businessId: string, lines: CartLine[], fetchBatch: (ids: string[]) => Promise<ProductEntity[]>): Promise<CartLine[]> => {
  cartTotal(lines);
  const products = new Map<string, ProductEntity>();
  for (let start = 0; start < lines.length; start += 100) {
    const ids = lines.slice(start, start + 100).map((line) => line.product_id);
    for (const product of await fetchBatch(ids)) products.set(product.id, product);
  }
  const result = lines.map((line) => {
    const product = products.get(line.product_id);
    if (!product || product.business_id !== businessId) throw new Error("unavailable_product");
    if (measurementUnit(product.measurement_unit) !== measurementUnit(line.measurement_unit)) throw new Error("unit_changed");
    return { ...productToCartLine(product), quantity: line.quantity, ...(line.unit_price_override == null ? {} : { unit_price_override: line.unit_price_override }) };
  });
  cartTotal(result);
  return result;
};
