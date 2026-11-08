import { BadRequestException } from '@nestjs/common';

export const PRODUCT_MEASUREMENT_UNITS = [
  'unit',
  'kg',
  'g',
  'bundle',
] as const;

export type ProductMeasurementUnit = (typeof PRODUCT_MEASUREMENT_UNITS)[number];

export function isProductMeasurementUnit(
  value: unknown,
): value is ProductMeasurementUnit {
  return typeof value === 'string' &&
    PRODUCT_MEASUREMENT_UNITS.some((unit) => unit === value);
}

export function validateProductMeasurementUnit(
  value: unknown,
): asserts value is ProductMeasurementUnit {
  if (!isProductMeasurementUnit(value))
    throw new BadRequestException('product:invalid_measurement_unit');
}

/** Absence is meaningful: never manufacture a supplier identifier. */
export function normalizeProductCode(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string')
    throw new BadRequestException('product:invalid_code');
  const code = value.trim();
  // DTO MaxLength and PostgreSQL varchar count Unicode code points, not UTF-16 units.
  let length = 0;
  for (const _character of code)
    if (++length > 255) throw new BadRequestException('product:invalid_code');
  return code || null;
}
