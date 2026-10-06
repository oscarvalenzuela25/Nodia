import { BadRequestException } from '@nestjs/common';
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import type { RentalQueryDto } from './dto/rental-query.dto.js';
import type { RentalActive, RentalPage } from './types/rental.types.js';
import { civilDays, isCivilDate, isRentalInstant } from './rental-time.js';

export type RentalQueryResource =
  | 'properties'
  | 'collaborators'
  | 'policies'
  | 'reservations'
  | 'payments'
  | 'expenses'
  | 'blocks'
  | 'turnovers'
  | 'audit';
const configuration: Record<
  RentalQueryResource,
  { filters: string[]; sorts: string[]; defaultSort: string; active?: boolean }
> = {
  properties: {
    filters: ['name_cont'],
    sorts: ['name'],
    defaultSort: 'name asc',
    active: true,
  },
  collaborators: {
    filters: ['position_cont'],
    sorts: ['created_at'],
    defaultSort: 'created_at desc',
    active: true,
  },
  policies: {
    filters: ['name_cont'],
    sorts: ['name'],
    defaultSort: 'name asc',
    active: true,
  },
  reservations: {
    filters: ['guest_name_cont', 'external_reference_cont'],
    sorts: ['check_in_on', 'created_at'],
    defaultSort: 'check_in_on desc',
    active: true,
  },
  payments: {
    filters: ['reference_cont'],
    sorts: ['occurred_on'],
    defaultSort: 'occurred_on desc',
  },
  expenses: {
    filters: ['name_cont'],
    sorts: ['incurred_on'],
    defaultSort: 'incurred_on desc',
  },
  blocks: {
    filters: ['reason_cont'],
    sorts: ['starts_at'],
    defaultSort: 'starts_at desc',
    active: true,
  },
  turnovers: {
    filters: [],
    sorts: ['planned_ready_at'],
    defaultSort: 'planned_ready_at asc',
  },
  audit: { filters: [], sorts: [], defaultSort: 'created_at desc' },
};
export function validateRentalQuery(
  query: RentalQueryDto & { active?: RentalActive },
  resource: RentalQueryResource,
): void {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    query.page > 1000000 ||
    !Number.isSafeInteger(query.limit) ||
    query.limit < 1 ||
    query.limit > 100
  )
    throw new BadRequestException('rental:invalid_input');
  const config = configuration[resource];
  if (
    query.active !== undefined &&
    (!config.active || !['active', 'inactive', 'all'].includes(query.active))
  )
    throw new BadRequestException('rental:invalid_input');
  validateRansackEnvelope(query.q);
  if (query.q === undefined) return;
  if (
    Object.keys(query.q).length > 32 ||
    Buffer.byteLength(JSON.stringify(query.q)) > 8192
  )
    throw new BadRequestException('rental:invalid_input');
  for (const [key, value] of Object.entries(query.q)) {
    if (typeof value !== 'string' || value.length > 255)
      throw new BadRequestException('rental:invalid_input');
    if (key === 's') {
      const match = /^([a-z_]+) (asc|desc)$/i.exec(value);
      if (!match || !config.sorts.includes(match[1]))
        throw new BadRequestException('rental:invalid_input');
    } else if (!config.filters.includes(key))
      throw new BadRequestException('rental:invalid_input');
  }
}
export function applyRentalQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  query: RentalQueryDto & { active?: RentalActive },
  resource: RentalQueryResource,
): void {
  validateRentalQuery(query, resource);
  const config = configuration[resource];
  if (config.active && query.active !== 'all')
    qb.andWhere(`${alias}.is_active = :rentalActive`, {
      rentalActive: query.active !== 'inactive',
    });
  const filters = Object.fromEntries(
    Object.entries(query.q ?? {}).filter(([key]) => key !== 's'),
  );
  const policy = Object.fromEntries(
    config.filters.map((key) => [key.slice(0, -5), 'text' as const]),
  );
  applyRansack(qb, filters, alias, policy);
  const sort = typeof query.q?.s === 'string' ? query.q.s : config.defaultSort;
  const [field, direction] = sort.split(' ');
  qb.orderBy(
    `${alias}.${field}`,
    direction.toUpperCase() as 'ASC' | 'DESC',
    field === 'planned_ready_at' ? 'NULLS LAST' : undefined,
  ).addOrderBy(`${alias}.id`, direction.toUpperCase() as 'ASC' | 'DESC');
}
export function pageResult<T>(
  data: T[],
  total: number,
  query: Pick<RentalQueryDto, 'page' | 'limit'>,
): RentalPage<T> {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new BadRequestException('rental:window_too_large');
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total_items: total,
      total_pages: Math.ceil(total / query.limit),
    },
  };
}
export const rentalPage = pageResult;
export function validateCivilPeriod(
  from: string | undefined,
  to: string | undefined,
  maxDays = 366,
): void {
  if (from === undefined && to === undefined) return;
  if (
    !isCivilDate(from) ||
    !isCivilDate(to) ||
    civilDays(from, to) <= 0 ||
    civilDays(from, to) > maxDays
  )
    throw new BadRequestException('rental:invalid_input');
}
export function validateInstantPeriod(
  from: string | undefined,
  to: string | undefined,
): void {
  if (from === undefined && to === undefined) return;
  if (
    !isRentalInstant(from) ||
    !isRentalInstant(to) ||
    Date.parse(to) <= Date.parse(from) ||
    Date.parse(to) - Date.parse(from) > 366 * 86400000
  )
    throw new BadRequestException('rental:invalid_input');
}
