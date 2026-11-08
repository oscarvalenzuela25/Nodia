import type { EntityManager } from 'typeorm';
import { isProductMeasurementUnit, type ProductMeasurementUnit } from '../product/product-measurement-unit.js';
export interface InvoiceOcrComparableItem { code: string | null; name: string; cost_price: number | null; cost_price_tax: number | null; measurement_unit?: ProductMeasurementUnit | null }
export interface InvoiceOcrExistingProduct { id: string; code: string | null; cost_price: number | null; cost_price_tax: number | null; measurement_unit?: ProductMeasurementUnit | null }
const numeric = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
// JSON/SQL expose Number values. Remove binary arithmetic noise without
// truncating real fractional percentages or imposing a currency scale.
const stableNumber = (value: number): number => Number.isFinite(value) ? Number(value.toPrecision(15)) : value;
function delta(previous: number | null, current: number | null, comparable = true) {
  const before = numeric(previous) ? previous : null, after = numeric(current) ? current : null;
  const amount = comparable && before !== null && after !== null ? stableNumber(after - before) : null;
  const percentage = amount === null || before === null || before <= 0 ? null : stableNumber(amount / before * 100);
  return { previous: before, current: after, delta: amount,
    percent: percentage !== null && Number.isFinite(percentage) ? percentage : null,
    direction: amount === null ? 'unknown' : amount > 0 ? 'up' : amount < 0 ? 'down' : 'same' };
}
// Historical OCR and pre-unit products use the original unit basis. Explicit
// null stays unknown; a kilogram/gram/bundle price is never compared to it.
const comparisonUnit = (value: ProductMeasurementUnit | null | undefined) =>
  value === undefined ? 'unit' : isProductMeasurementUnit(value) ? value : null;
/** Compare purchase net to net and gross to gross. No sale price, tax or margin is invented. */
export function compareInvoiceOcrPrices(items: readonly InvoiceOcrComparableItem[], products: readonly InvoiceOcrExistingProduct[]) {
  return items.map((item, index) => {
    const code = item.code?.trim().toLocaleLowerCase('en');
    const matches = code ? products.filter(p => p.code?.trim().toLocaleLowerCase('en') === code) : [];
    const product = matches.length === 1 ? matches[0] : undefined;
    const unit = comparisonUnit(item.measurement_unit);
    const comparable = Boolean(product && unit !== null && unit === comparisonUnit(product.measurement_unit));
    return { index, code: item.code, name: item.name, product_id: product?.id ?? null,
      match: !code ? 'missing_code' : matches.length === 0 ? 'unmatched' : matches.length > 1 ? 'ambiguous' : 'unique',
      net: delta(product?.cost_price ?? null, item.cost_price, comparable),
      gross: delta(product?.cost_price_tax ?? null, item.cost_price_tax, comparable) };
  });
}

/** Read-only current commercial values. The caller must hold current business authority. */
export async function loadInvoiceOcrComparison(manager: EntityManager, businessId: string,
  items: readonly InvoiceOcrComparableItem[], maxItems: number) {
  if (items.length > maxItems) throw new Error('nodia_ai:result_limit');
  const codes = [...new Set(items.flatMap(item => item.code?.trim() ? [item.code.trim().toLowerCase()] : []))];
  const products: InvoiceOcrExistingProduct[] = codes.length ? await manager.query(
    'SELECT id::text,code,cost_price,cost_price_tax,measurement_unit FROM products WHERE business_id=$1 AND code IS NOT NULL AND lower(btrim(code))=ANY($2::text[]) ORDER BY id LIMIT $3',
    [businessId, codes, maxItems + 1]) : [];
  if (products.length > maxItems) throw new Error('nodia_ai:result_limit');
  return compareInvoiceOcrPrices(items, products);
}
