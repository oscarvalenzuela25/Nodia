import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { validateRansackEnvelope } from '../../common/utils/ransack-query.builder.js';
import { CASH_MOVEMENT_SORTS } from '../dto/query-cash-movements.dto.js';
import { assertCashFields, normalizeCashUuid } from './cash-category.policy.js';
import { isCashMovementDate } from './cash-movement-date.js';
import {
  CASH_INVALID_QUERY,
  invalidCashQuery,
  normalizeCashActivity,
  normalizeCashPagination,
  normalizeCashSearch,
} from './cash-query.policy.js';

function optionalDate(value: unknown): string | undefined {
  if (value === undefined || isCashMovementDate(value)) return value;
  return invalidCashQuery();
}

function optionalCategoryId(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return invalidCashQuery();
  validateCatalogId(value, CASH_INVALID_QUERY);
  return value;
}

export function normalizeCashMovementQuery(value: unknown) {
  assertCashFields(value, ['q', 'page', 'limit'], CASH_INVALID_QUERY);
  const q = value.q;
  assertCashFields(
    q,
    [
      'business_id_eq',
      'category_id_eq',
      'occurred_on_gteq',
      'occurred_on_lteq',
      'is_active_eq',
      'search',
      's',
    ],
    CASH_INVALID_QUERY,
  );
  validateRansackEnvelope(q);

  const from = optionalDate(q.occurred_on_gteq);
  const to = optionalDate(q.occurred_on_lteq);
  if (from && to && from > to) return invalidCashQuery();
  const sort = CASH_MOVEMENT_SORTS.find((candidate) => candidate === q.s);
  if (q.s !== undefined && sort === undefined) return invalidCashQuery();

  return {
    ...normalizeCashPagination(value.page, value.limit),
    filters: {
      business_id_eq: normalizeCashUuid(q.business_id_eq, CASH_INVALID_QUERY),
      category_id_eq: optionalCategoryId(q.category_id_eq),
      occurred_on_gteq: from,
      occurred_on_lteq: to,
      is_active_eq: normalizeCashActivity(q.is_active_eq),
    },
    search: normalizeCashSearch(q.search),
    order: sort?.startsWith('amount')
      ? ('amount' as const)
      : ('occurred_on' as const),
    direction: sort?.endsWith(' asc') ? ('ASC' as const) : ('DESC' as const),
  };
}
