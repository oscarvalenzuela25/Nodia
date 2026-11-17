import { BadRequestException } from '@nestjs/common';
import { validateRansackEnvelope } from '../../common/utils/ransack-query.builder.js';
import {
  CASH_CATEGORY_SORTS,
  CASH_MAX_LIMIT,
  CASH_MAX_PAGE,
} from '../dto/query-cash-categories.dto.js';
import {
  assertCashFields,
  isCashText,
  normalizeCashUuid,
  trimCashText,
} from './cash-category.policy.js';

const invalidCode = 'business:cash_invalid_query';
const invalid = (): never => {
  throw new BadRequestException(invalidCode);
};

function positiveInteger(value: unknown, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > max
  )
    return invalid();
  return value;
}

export function normalizeCashCategoryQuery(value: unknown) {
  assertCashFields(value, ['q', 'page', 'limit'], invalidCode);
  const q = value.q;
  assertCashFields(
    q,
    ['business_id_eq', 'name_cont', 'is_active_eq', 's'],
    invalidCode,
  );
  validateRansackEnvelope(q);

  const activity = q.is_active_eq;
  if (
    activity !== undefined &&
    ![true, false, 'true', 'false'].some((item) => item === activity)
  )
    return invalid();
  if (q.s !== undefined && !CASH_CATEGORY_SORTS.some((sort) => sort === q.s))
    return invalid();

  let name: string | undefined;
  if (q.name_cont !== undefined) {
    if (!isCashText(q.name_cont)) return invalid();
    name = trimCashText(q.name_cont);
    if ([...name].length > 255) return invalid();
  }

  return {
    page: positiveInteger(
      value.page === undefined ? 1 : value.page,
      CASH_MAX_PAGE,
    ),
    limit: positiveInteger(
      value.limit === undefined ? 10 : value.limit,
      CASH_MAX_LIMIT,
    ),
    filters: {
      business_id_eq: normalizeCashUuid(q.business_id_eq, invalidCode),
      name_cont: name || undefined,
      is_active_eq:
        activity === undefined
          ? undefined
          : activity === true || activity === 'true',
    },
    direction: q.s === 'name desc' ? ('DESC' as const) : ('ASC' as const),
  };
}
