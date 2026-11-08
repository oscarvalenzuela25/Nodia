import { BadRequestException } from '@nestjs/common';

export const SALE_MAX_QUANTITY = 2147483647;
const scale = 1000n;

/** Canonical quantities use at most three decimals; no monetary float arithmetic. */
export function saleQuantityThousandths(value: unknown): bigint {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new BadRequestException('business:sale_invalid_command');
  const text = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(text))
    throw new BadRequestException('business:sale_invalid_command');
  const [whole, fraction = ''] = text.split('.');
  const quantity = BigInt(whole) * scale + BigInt(fraction.padEnd(3, '0'));
  if (quantity <= 0n || quantity > BigInt(SALE_MAX_QUANTITY) * scale)
    throw new BadRequestException('business:sale_invalid_command');
  return quantity;
}

export function saleQuantity(value: unknown): number {
  saleQuantityThousandths(value);
  return value as number;
}

/** PostgreSQL NUMERIC strings are bounded before conversion to the wire number. */
export const saleQuantityTransformer = {
  to(value: number): number {
    return saleQuantity(value);
  },
  from(value: string | number): number {
    if (
      typeof value === 'string' &&
      !/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(value)
    )
      throw new BadRequestException('business:sale_invalid_command');
    return saleQuantity(typeof value === 'string' ? Number(value) : value);
  },
};

/** Positive CLP subtotal rounds HALF_UP once per line, then headers sum pesos. */
export function roundedSaleLineTotal(
  unitPrice: bigint,
  quantity: unknown,
): bigint {
  return (unitPrice * saleQuantityThousandths(quantity) + scale / 2n) / scale;
}

/** Exact nonnegative report quantities, including zero and unbounded aggregates. */
export function exactSaleQuantityReport(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(value)
  )
    throw new Error('business:sale_report_invalid');
  return value.includes('.')
    ? value.replace(/0+$/, '').replace(/\.$/, '')
    : value;
}
