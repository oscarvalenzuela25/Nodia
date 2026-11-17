import { validateRansackEnvelope } from '../../common/utils/ransack-query.builder.js';
import { CASH_CATEGORY_SORTS } from '../dto/query-cash-categories.dto.js';
import { assertCashFields, normalizeCashUuid } from './cash-category.policy.js';
import {
  CASH_INVALID_QUERY,
  invalidCashQuery,
  normalizeCashActivity,
  normalizeCashPagination,
  normalizeCashSearch,
} from './cash-query.policy.js';

export function normalizeCashCategoryQuery(value: unknown) {
  assertCashFields(value, ['q', 'page', 'limit'], CASH_INVALID_QUERY);
  const q = value.q;
  assertCashFields(
    q,
    ['business_id_eq', 'name_cont', 'is_active_eq', 's'],
    CASH_INVALID_QUERY,
  );
  validateRansackEnvelope(q);

  if (q.s !== undefined && !CASH_CATEGORY_SORTS.some((sort) => sort === q.s))
    return invalidCashQuery();

  return {
    ...normalizeCashPagination(value.page, value.limit),
    filters: {
      business_id_eq: normalizeCashUuid(q.business_id_eq, CASH_INVALID_QUERY),
      name_cont: normalizeCashSearch(q.name_cont),
      is_active_eq: normalizeCashActivity(q.is_active_eq),
    },
    direction: q.s === 'name desc' ? ('DESC' as const) : ('ASC' as const),
  };
}
