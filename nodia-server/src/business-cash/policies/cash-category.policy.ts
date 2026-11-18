import { BadRequestException } from '@nestjs/common';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import type { CashCategory } from '../types/cash.types.js';

export const CASH_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const CASH_MAX_VERSION = 2147483647;
const unpairedSurrogate = /[\uD800-\uDFFF]/u;
const whitespace = /[\p{White_Space}\uFEFF]/u;
const optionalFields = ['name', 'description', 'is_active'] as const;

export interface CashCategoryFields {
  name: string;
  normalized_name: string;
  description: string;
  is_active: boolean;
}

const invalid = (): never => {
  throw new BadRequestException('business:cash_invalid_command');
};

export function normalizeCashUuid(
  value: unknown,
  message = 'business:cash_invalid_command',
): string {
  if (typeof value !== 'string' || !CASH_UUID_PATTERN.test(value))
    throw new BadRequestException(message);
  return value.toLowerCase();
}

export function validateCashCategoryId(id: string): void {
  validateCatalogId(id, 'business:cash_invalid_command');
}

export function assertCashFields(
  value: unknown,
  allowed: readonly string[],
  message = 'business:cash_invalid_command',
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    throw new BadRequestException(message);
}

export function trimCashText(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && whitespace.test(value[start])) start++;
  while (end > start && whitespace.test(value[end - 1])) end--;
  return value.slice(start, end);
}

export function isCashText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !value.includes('\u0000') &&
    !unpairedSurrogate.test(value)
  );
}

function text(value: unknown, max: number, normalize = false): string {
  if (!isCashText(value)) return invalid();
  const result = trimCashText(normalize ? value.normalize('NFKC') : value);
  if ([...result].length > max) return invalid();
  return result;
}

function categoryName(
  value: unknown,
): Pick<CashCategoryFields, 'name' | 'normalized_name'> {
  const name = text(value, 120, true);
  // Removing spaces first preserves contextual lowercasing such as Greek final sigma.
  const normalized_name = name
    .replace(/[\p{White_Space}\uFEFF]+/gu, '')
    .toLocaleLowerCase('es')
    .normalize('NFKC');
  if (!normalized_name || Buffer.byteLength(normalized_name, 'utf8') > 1024)
    return invalid();
  return { name, normalized_name };
}

export function normalizeCashDescription(value: unknown): string {
  return text(value === undefined ? '' : value, 500);
}

export function normalizeCashActivity(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid();
  return value;
}

export function normalizeCashVersion(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > CASH_MAX_VERSION
  )
    return invalid();
  return value;
}

export function normalizeCashCategoryCreate(
  value: unknown,
): CashCategoryFields & { business_id: string; request_key: string } {
  assertCashFields(value, ['business_id', 'request_key', ...optionalFields]);
  return {
    business_id: normalizeCashUuid(value.business_id),
    request_key: normalizeCashUuid(value.request_key),
    ...categoryName(value.name),
    description: normalizeCashDescription(value.description),
    is_active:
      value.is_active === undefined
        ? true
        : normalizeCashActivity(value.is_active),
  };
}

export function normalizeCashCategoryUpdate(
  value: unknown,
): Partial<CashCategoryFields> & {
  request_key: string;
  expected_version: number;
} {
  assertCashFields(value, [
    'request_key',
    'expected_version',
    ...optionalFields,
  ]);
  if (optionalFields.every((field) => value[field] === undefined))
    return invalid();
  return {
    request_key: normalizeCashUuid(value.request_key),
    expected_version: normalizeCashVersion(value.expected_version),
    ...(value.name === undefined ? {} : categoryName(value.name)),
    ...(value.description === undefined
      ? {}
      : { description: normalizeCashDescription(value.description) }),
    ...(value.is_active === undefined
      ? {}
      : { is_active: normalizeCashActivity(value.is_active) }),
  };
}

export function publicCashCategory({
  id,
  business_id,
  name,
  description,
  is_active,
  version,
}: CashCategory): CashCategory {
  return { id, business_id, name, description, is_active, version };
}
