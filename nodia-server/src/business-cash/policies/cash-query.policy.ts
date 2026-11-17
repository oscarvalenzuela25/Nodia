import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CASH_MAX_LIMIT, CASH_MAX_PAGE } from '../dto/cash-list-page.dto.js';
import { isCashText, trimCashText } from './cash-category.policy.js';

export const CASH_INVALID_QUERY = 'business:cash_invalid_query';

export function invalidCashQuery(): never {
  throw new BadRequestException(CASH_INVALID_QUERY);
}

function positiveInteger(value: unknown, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > max
  )
    return invalidCashQuery();
  return value;
}

export function normalizeCashPagination(page: unknown, limit: unknown) {
  return {
    page: positiveInteger(page === undefined ? 1 : page, CASH_MAX_PAGE),
    limit: positiveInteger(limit === undefined ? 10 : limit, CASH_MAX_LIMIT),
  };
}

export function normalizeCashActivity(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return invalidCashQuery();
}

export function normalizeCashSearch(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (!isCashText(value)) return invalidCashQuery();
  const term = trimCashText(value);
  if ([...term].length > 255) return invalidCashQuery();
  return term || undefined;
}

export function cashReadCount(value: unknown): number {
  if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) {
    const count = Number(value);
    if (Number.isSafeInteger(count)) return count;
  }
  throw new InternalServerErrorException('business:cash_invalid_total');
}
