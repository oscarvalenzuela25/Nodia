import { BadRequestException } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import type { RansackPolicy } from '../common/types/ransack.type.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import type { FinanceQueryDto } from './dto/finance-query.dto.js';
import type { FinancePage } from './types/finance.types.js';

export type FinanceQueryResource =
  'categories' | 'category-groups' | 'movements' | 'obligations';

const CATALOG_FILTERS = ['name_cont', 'key_cont'];
const MOVEMENT_FILTERS = [
  'name_cont',
  'type_eq',
  'status_eq',
  'created_at_gteq',
  'created_at_lt',
];
const CATALOG_SORTS = ['id', 'name', 'key', 'created_at', 'updated_at'];
const MOVEMENT_SORTS = ['id', 'name', 'type', 'status', 'created_at'];

function invalid(): never {
  throw new BadRequestException('finance:invalid_query');
}

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

function validDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(
      value,
    )
  )
    return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

/** Validate the complete command before any domain filters or SQL are consumed. */
export function validateFinanceQuery(
  query: FinanceQueryDto,
  resource: FinanceQueryResource,
): void {
  if (!query || typeof query !== 'object' || Array.isArray(query)) invalid();
  const allowed = [
    'page',
    'limit',
    'active',
    'q',
    'category_ids',
    'category_group_ids',
    'obligation_id',
  ];
  if (Object.keys(query).some((key) => !allowed.includes(key))) invalid();
  if (query.page === null || query.limit === null || query.active === null)
    invalid();
  if (
    !Number.isSafeInteger(query.page ?? 1) ||
    (query.page ?? 1) < 1 ||
    (query.page ?? 1) > 1000000
  )
    invalid();
  if (
    !Number.isSafeInteger(query.limit ?? 10) ||
    (query.limit ?? 10) < 1 ||
    (query.limit ?? 10) > 100
  )
    invalid();
  if (!['active', 'inactive', 'all'].includes(query.active ?? 'active'))
    invalid();
  for (const values of [query.category_ids, query.category_group_ids]) {
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.length > 100 ||
        values.some((value) => !validId(value)) ||
        new Set(values).size !== values.length)
    )
      invalid();
  }
  if (query.obligation_id !== undefined && !validId(query.obligation_id))
    invalid();
  if (
    resource !== 'movements' &&
    (query.category_ids !== undefined ||
      query.category_group_ids !== undefined ||
      query.obligation_id !== undefined)
  )
    invalid();
  validateRansackEnvelope(query.q);
  if (query.q === undefined) return;
  const filters =
    resource === 'movements'
      ? MOVEMENT_FILTERS
      : resource === 'obligations'
        ? [...CATALOG_FILTERS, 'type_eq']
        : CATALOG_FILTERS;
  const sorts =
    resource === 'movements'
      ? MOVEMENT_SORTS
      : resource === 'obligations'
        ? [...CATALOG_SORTS, 'type']
        : CATALOG_SORTS;
  for (const [key, value] of Object.entries(query.q)) {
    if (typeof value !== 'string') invalid();
    if (key === 's') {
      const match = /^([a-z_][a-z0-9_]*)\s+(asc|desc)$/i.exec(value);
      if (!match || !sorts.includes(match[1])) invalid();
    } else {
      if (!filters.includes(key)) invalid();
      if (
        key === 'type_eq' &&
        !(
          resource === 'movements' ? ['income', 'expense'] : ['loan', 'debt']
        ).includes(value)
      )
        invalid();
      if (
        key === 'status_eq' &&
        !['pending', 'received', 'paid', 'cancelled'].includes(value)
      )
        invalid();
      if (key.startsWith('created_at_') && !validDate(value)) invalid();
    }
  }
  const q = query.q as Record<string, unknown>;
  if (
    (q.type_eq === 'income' && q.status_eq === 'paid') ||
    (q.type_eq === 'expense' && q.status_eq === 'received')
  )
    invalid();
  if (
    typeof q.created_at_gteq === 'string' &&
    typeof q.created_at_lt === 'string' &&
    Date.parse(q.created_at_gteq) >= Date.parse(q.created_at_lt)
  )
    invalid();
}

export function applyFinanceQuery<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  query: FinanceQueryDto,
  resource: FinanceQueryResource,
): SelectQueryBuilder<T> {
  validateFinanceQuery(query, resource);
  const policy: RansackPolicy =
    resource === 'movements'
      ? {
          id: 'bigint',
          name: 'text',
          type: 'text',
          status: 'text',
          created_at: 'date',
        }
      : {
          id: 'bigint',
          name: 'text',
          key: 'text',
          created_at: 'date',
          updated_at: 'date',
          ...(resource === 'obligations' ? { type: 'text' as const } : {}),
        };
  applyRansack(qb, query.q, alias, policy);
  const active = query.active ?? 'active';
  if (active !== 'all')
    qb.andWhere(`${alias}.is_active = :finance_active`, {
      finance_active: active === 'active',
    });
  if (!query.q?.s)
    qb.addOrderBy(
      `${alias}.${resource === 'movements' ? 'created_at' : 'name'}`,
      resource === 'movements' ? 'DESC' : 'ASC',
    );
  if (!query.q?.s || !/^id\s/i.test(query.q.s as string)) {
    qb.addOrderBy(`${alias}.id`, resource === 'movements' ? 'DESC' : 'ASC');
  }
  return qb;
}

/** EXISTS preserves one movement per row even when selected groups overlap. */
export function applyFinanceMovementFilters<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  query: FinanceQueryDto,
): SelectQueryBuilder<T> {
  validateFinanceQuery(query, 'movements');
  if (query.category_ids?.length)
    qb.andWhere(`${alias}.category_id IN (:...finance_categories)`, {
      finance_categories: query.category_ids,
    });
  if (query.category_group_ids?.length) {
    qb.andWhere(
      `EXISTS (SELECT 1 FROM finance_category_group_memberships finance_membership WHERE finance_membership.user_id = ${alias}.user_id AND finance_membership.category_id = ${alias}.category_id AND finance_membership.is_active = TRUE AND finance_membership.category_group_id IN (:...finance_groups))`,
      { finance_groups: query.category_group_ids },
    );
  }
  if (query.obligation_id !== undefined)
    qb.andWhere(`${alias}.obligation_id = :finance_obligation`, {
      finance_obligation: query.obligation_id,
    });
  return qb;
}

export function financePage<T>(
  data: T[],
  total: number,
  query: FinanceQueryDto,
): FinancePage<T> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  return {
    data,
    meta: {
      page,
      limit,
      total_items: total,
      total_pages: Math.ceil(total / limit),
    },
  };
}
