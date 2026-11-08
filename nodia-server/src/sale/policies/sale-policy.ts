import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { validateProductMeasurementUnit } from '../../product/product-measurement-unit.js';
import { roundedSaleLineTotal, saleQuantity } from './sale-quantity.js';
import {
  SALE_PAYMENT_METHODS,
  SALE_STATUSES,
  type ProductSaleRow,
  type SaleItemInput,
  type SaleItemSnapshot,
  type SaleItemView,
  type SaleListQuery,
  type SaleMutationCommand,
  type SaleOperation,
  type SalePaymentMethod,
  type SaleStatus,
} from '../types/sale.types.js';

export const SALE_MAX_ITEMS = 200;
export const SALE_TIMEZONE = 'America/Santiago';
const int64Max = 9223372036854775807n;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (): never => {
  throw new BadRequestException('business:sale_invalid_command');
};
export function saleUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) return invalid();
  return value.toLowerCase();
}
export function saleMoney(value: unknown): bigint {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) return invalid();
    value = String(value);
  }
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,18})$/.test(value))
    return invalid();
  const parsed = BigInt(value);
  if (parsed > int64Max) return invalid();
  return parsed;
}
function manualUnitPrice(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return invalid();
  return saleMoney(value);
}
function integer(value: unknown, max = 2147483647): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > max
  )
    return invalid();
  return value;
}
function keys(
  value: unknown,
  allowed: readonly string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) =>
        (value as Record<string, unknown>)[key] !== undefined &&
        !allowed.includes(key),
    )
  )
    invalid();
}
function paymentMethod(value: unknown): SalePaymentMethod {
  const method = SALE_PAYMENT_METHODS.find((method) => method === value);
  if (!method) return invalid();
  return method;
}
export function normalizeSaleCommand(
  operation: SaleOperation,
  value: unknown,
): SaleMutationCommand {
  const createsSale = operation === 'create' || operation === 'checkout';
  const common = [
    'request_key',
    ...(createsSale ? [] : ['sale_id', 'expected_version']),
  ];
  const editable = ['items', 'payment_method', 'payment_method_description'];
  keys(value, [
    ...common,
    ...(['create', 'checkout', 'update'].includes(operation) ? editable : []),
    ...(operation === 'cancel' ? ['cancellation_reason'] : []),
  ]);
  const command: SaleMutationCommand = {
    request_key: saleUuid(value.request_key),
  };
  if (!createsSale) {
    command.sale_id = saleUuid(value.sale_id);
    command.expected_version = integer(value.expected_version);
  }
  if (value.items !== undefined) {
    if (!Array.isArray(value.items) || value.items.length > SALE_MAX_ITEMS)
      return invalid();
    const ids = new Set<string>();
    command.items = value.items.map((item): SaleItemInput => {
      keys(item, [
        'product_id',
        'quantity',
        'expected_product_version',
        'expected_unit_price',
        'unit_price_override',
      ]);
      if (
        typeof item.product_id !== 'string' ||
        !/^[1-9][0-9]{0,18}$/.test(item.product_id) ||
        BigInt(item.product_id) > int64Max ||
        ids.has(item.product_id)
      )
        return invalid();
      ids.add(item.product_id);
      const override = manualUnitPrice(item.unit_price_override);
      return {
        product_id: item.product_id,
        quantity: saleQuantity(item.quantity),
        expected_product_version: integer(item.expected_product_version),
        expected_unit_price: saleMoney(item.expected_unit_price).toString(),
        ...(override === null
          ? {}
          : { unit_price_override: override.toString() }),
      };
    });
  }
  if (operation === 'checkout' && !command.items?.length) return invalid();
  if (operation === 'create' && command.items === undefined) command.items = [];
  if (value.payment_method !== undefined)
    command.payment_method = paymentMethod(value.payment_method);
  else if (createsSale) command.payment_method = 'cash';
  if (value.payment_method_description !== undefined) {
    const description = value.payment_method_description;
    if (
      description !== null &&
      (typeof description !== 'string' || description.length > 500)
    )
      return invalid();
    command.payment_method_description =
      typeof description === 'string' ? description.trim() || null : null;
  } else if (createsSale) command.payment_method_description = null;
  if (operation === 'cancel') {
    if (
      typeof value.cancellation_reason !== 'string' ||
      !value.cancellation_reason.trim() ||
      value.cancellation_reason.length > 500
    )
      return invalid();
    command.cancellation_reason = value.cancellation_reason.trim();
  }
  return command;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function saleCommandHash(
  operation: SaleOperation,
  command: SaleMutationCommand,
): string {
  return createHash('sha256')
    .update(canonical({ operation, command }))
    .digest('hex');
}
export function assertSaleTransition(
  status: SaleStatus,
  operation: SaleOperation,
): SaleStatus {
  if (operation === 'create') return 'draft';
  if (operation === 'checkout' && status === 'draft') return 'completed';
  if (operation === 'update' && status === 'draft') return 'draft';
  if (operation === 'complete' && status === 'draft') return 'completed';
  if (operation === 'cancel' && status === 'completed') return 'cancelled';
  if (operation === 'discard' && status === 'draft') return 'discarded';
  throw new ConflictException('business:sale_state_conflict');
}
export function snapshotSaleItems(
  inputs: SaleItemInput[],
  products: readonly ProductSaleRow[],
): SaleItemSnapshot[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  let total = 0n;
  return inputs.map((input, position) => {
    const product = byId.get(input.product_id);
    if (!product || product.is_active !== true || product.has_stock !== true)
      throw new ConflictException('business:sale_product_unavailable');
    const normal = saleMoney(product.sale_price);
    const offer =
      product.offer_price === null ? null : saleMoney(product.offer_price);
    const catalogPrice = product.is_offer_enabled ? offer : normal;
    if (catalogPrice === null)
      throw new ConflictException('business:sale_product_price_missing');
    if (
      product.version !== input.expected_product_version ||
      catalogPrice !== saleMoney(input.expected_unit_price)
    )
      throw new ConflictException('business:sale_product_changed');
    validateProductMeasurementUnit(product.measurement_unit);
    const override = manualUnitPrice(input.unit_price_override);
    const price = override ?? catalogPrice;
    const line = roundedSaleLineTotal(price, input.quantity);
    total += line;
    if (line > int64Max || total > int64Max)
      throw new BadRequestException('business:sale_amount_overflow');
    return {
      id: randomUUID(),
      product_id: product.id,
      position,
      quantity: input.quantity,
      product_code_snapshot: product.code,
      measurement_unit_snapshot: product.measurement_unit,
      product_barcode_snapshot: product.barcode,
      product_name_snapshot: product.name,
      regular_unit_price: normal.toString(),
      offer_price_snapshot: offer?.toString() ?? null,
      is_offer_enabled_snapshot: product.is_offer_enabled,
      price_source:
        override !== null
          ? 'manual'
          : product.is_offer_enabled
            ? 'offer'
            : 'regular',
      unit_price: price.toString(),
      line_total: line.toString(),
      product_version: product.version,
      cost_price_snapshot:
        product.cost_price === null
          ? null
          : saleMoney(product.cost_price).toString(),
      cost_price_tax_snapshot:
        product.cost_price_tax === null
          ? null
          : saleMoney(product.cost_price_tax).toString(),
    };
  });
}
/** Confirmation revalidates the observed catalog while preserving an explicit sale-only price. */
export function saleItemInputsFromSnapshots(
  items: readonly SaleItemView[],
): SaleItemInput[] {
  return items.map((item) => {
    const catalogPrice = item.is_offer_enabled_snapshot
      ? item.offer_price_snapshot
      : item.regular_unit_price;
    if (catalogPrice === null)
      throw new ConflictException('business:sale_product_price_missing');
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      expected_product_version: item.product_version,
      expected_unit_price: saleMoney(catalogPrice).toString(),
      ...(item.price_source === 'manual'
        ? { unit_price_override: saleMoney(item.unit_price).toString() }
        : {}),
    };
  });
}
export function normalizeSaleQuery(
  value: SaleListQuery = {},
): SaleListQuery & { page: number; limit: number } {
  keys(value, [
    'page',
    'limit',
    'status',
    'from',
    'to_exclusive',
    'search',
    'metric',
  ]);
  const query: SaleListQuery & { page: number; limit: number } = {
    ...value,
    page: integer(value.page ?? 1, 100000),
    limit: integer(value.limit ?? 20, 100),
  };
  if (query.status !== undefined && !SALE_STATUSES.includes(query.status))
    return invalid();
  if (query.metric !== undefined && !['units', 'amount'].includes(query.metric))
    return invalid();
  if (
    query.search !== undefined &&
    (typeof query.search !== 'string' || query.search.length > 255)
  )
    return invalid();
  const instant = (input: unknown) =>
    typeof input === 'string' &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      input,
    ) &&
    Number.isFinite(Date.parse(input)) &&
    new Date(`${input.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) ===
      input.slice(0, 10);
  if ((query.from === undefined) !== (query.to_exclusive === undefined))
    return invalid();
  if (
    query.from !== undefined &&
    (!instant(query.from) ||
      !instant(query.to_exclusive) ||
      Date.parse(query.from) >= Date.parse(query.to_exclusive!))
  )
    return invalid();
  return query;
}
