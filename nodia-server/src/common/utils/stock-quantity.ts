import { BadRequestException } from '@nestjs/common';

export const maxStockQuantity = 2147483647;

/** Thousandths fit safely in an integer throughout the supported stock range. */
export function stockQuantityMillis(value: unknown): number {
  if (typeof value !== 'number' || value < 0 || value > maxStockQuantity)
    throw new BadRequestException('product:invalid_stock');
  const [whole, fraction = ''] = String(value).split('.');
  if (!/^\d+$/.test(whole) || !/^\d{0,3}$/.test(fraction))
    throw new BadRequestException('product:invalid_stock');
  return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}

function readStockQuantity(value: number | string): number {
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new BadRequestException('product:invalid_stock');
  if (typeof value === 'string' && !/^-?\d+(?:\.\d{1,3})?$/.test(value))
    throw new BadRequestException('product:invalid_stock');
  const quantity = Number(value);
  // Rows predating inventory may have a negative integer while tracking is off.
  if (Number.isInteger(quantity) && quantity >= -2147483648 && quantity < 0)
    return quantity;
  stockQuantityMillis(quantity);
  return quantity;
}

export const stockQuantityTransformer = {
  to(value: number): number {
    return readStockQuantity(value);
  },
  from(value: number | string): number {
    return readStockQuantity(value);
  },
};
