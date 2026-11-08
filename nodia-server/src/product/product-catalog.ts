import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Product } from './entities/product.entity.js';
import {
  normalizeProductCode,
  validateProductMeasurementUnit,
} from './product-measurement-unit.js';

export const PRODUCT_BARCODE_PATTERN = /^(?!\s)(?!.*\s$)[^\p{Cc}]+$/u;

/** Retired fields must fail even for internal/OCR writers that bypass HTTP DTO validation. */
export function rejectRetiredProductFields(value: object): void {
  if (Object.hasOwn(value, 'profit_percentage'))
    throw new BadRequestException('product:profit_percentage_retired');
}

export function validateBarcode(
  value: unknown,
): asserts value is string | null {
  if (value === null) return;
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 255 ||
    value.trim() !== value ||
    !value.trim() ||
    !PRODUCT_BARCODE_PATTERN.test(value)
  )
    throw new BadRequestException('product:invalid_barcode');
}

export function validateCatalogProduct(
  product: Partial<Product>,
  create = false,
): void {
  rejectRetiredProductFields(product);
  if (product.code !== undefined) normalizeProductCode(product.code);
  if (product.measurement_unit !== undefined)
    validateProductMeasurementUnit(product.measurement_unit);
  if (product.barcode !== undefined) validateBarcode(product.barcode);
  if (create && typeof product.has_stock !== 'boolean')
    throw new BadRequestException('product:availability_required');
  if (
    product.has_stock !== undefined &&
    product.has_stock !== null &&
    typeof product.has_stock !== 'boolean'
  )
    throw new BadRequestException('product:invalid_availability');
  if (
    product.is_offer_enabled !== undefined &&
    typeof product.is_offer_enabled !== 'boolean'
  )
    throw new BadRequestException('product:invalid_offer');
  for (const field of ['sale_price', 'offer_price'] as const) {
    const value = product[field];
    if (value === undefined || (field === 'offer_price' && value === null))
      continue;
    if (!Number.isInteger(value) || value! < 0 || value! > 2147483647)
      throw new BadRequestException('product:invalid_price');
  }
  if (product.is_offer_enabled && product.offer_price == null)
    throw new BadRequestException('product:selected_price_missing');
}

export function checkProductVersion(
  product: Pick<Product, 'version'>,
  expected: unknown,
  required = false,
): void {
  if (expected === undefined && !required) return;
  if (!Number.isSafeInteger(expected) || Number(expected) < 1)
    throw new BadRequestException('product:version_required');
  if (product.version !== expected)
    throw new ConflictException('product:version_conflict');
}

export function catalogPrice(
  product: Pick<Product, 'sale_price' | 'offer_price' | 'is_offer_enabled'>,
) {
  const selected = product.is_offer_enabled
    ? product.offer_price
    : product.sale_price;
  const valid =
    typeof selected === 'number' &&
    Number.isInteger(selected) &&
    selected >= 0 &&
    selected <= 2147483647;
  return {
    effective_price: valid ? String(selected) : null,
    price_source: valid
      ? product.is_offer_enabled
        ? ('offer' as const)
        : ('regular' as const)
      : null,
  };
}

export function productSnapshot(
  product: Product,
  source: string,
  actorId: string,
  changedFields: string[],
  imageId?: string | null,
) {
  return {
    product_id: product.id,
    code: product.code,
    measurement_unit: product.measurement_unit,
    name: product.name,
    cost_price: product.cost_price,
    cost_price_tax: product.cost_price_tax,
    sale_price: product.sale_price,
    stock: product.stock,
    barcode: product.barcode ?? null,
    offer_price: product.offer_price ?? null,
    is_offer_enabled: product.is_offer_enabled ?? false,
    has_stock: product.has_stock ?? null,
    product_version: product.version,
    source,
    event_type: source,
    actor_id: actorId,
    changed_fields: changedFields,
    image_id: imageId ?? null,
  };
}
