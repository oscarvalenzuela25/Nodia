import { BadRequestException } from '@nestjs/common';

export const PRODUCT_ALIAS_MAX_LENGTH = 255;

/** Omission preserves a stored alias; null/blank explicitly leave it unassigned. */
export function normalizeProductAlias(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new BadRequestException('product:invalid_alias');
  const normalized = value.trim();
  if (Array.from(normalized).length > PRODUCT_ALIAS_MAX_LENGTH) throw new BadRequestException('product:invalid_alias');
  return normalized || null;
}
