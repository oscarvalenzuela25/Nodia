import { BadRequestException } from '@nestjs/common';

/** Persisted CLP selling prices use nearest ten, with ties rounded upward. */
export function roundProductSalePrice(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483647)
    throw new BadRequestException('product:invalid_price');
  const rounded = Math.floor((value + 5) / 10) * 10;
  if (rounded > 2147483647) throw new BadRequestException('product:invalid_price');
  return rounded;
}

/** Omitted PATCH prices and historical logs retain their original meaning. */
export function normalizeCatalogSalePrice<T extends { sale_price?: number }>(attributes: T): T {
  return attributes.sale_price === undefined ? attributes : { ...attributes, sale_price: roundProductSalePrice(attributes.sale_price) };
}
