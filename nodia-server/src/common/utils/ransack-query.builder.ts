import { BadRequestException } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import type {
  RansackField,
  RansackFieldKind,
  RansackPolicy,
  RansackPredicate,
} from '../types/ransack.type.js';

export const RANSACK_LIMITS = {
  conditions: 32,
  listItems: 1000,
  textLength: 2048,
} as const;

// Longest suffixes first: name_not_eq is field name + not_eq, never name_not + eq.
const PREDICATES: readonly RansackPredicate[] = [
  'not_cont',
  'not_null',
  'not_eq',
  'not_in',
  'gteq',
  'lteq',
  'start',
  'cont',
  'null',
  'end',
  'eq',
  'gt',
  'lt',
  'in',
];
const COMPARISONS: Partial<Record<RansackPredicate, string>> = {
  eq: '=',
  not_eq: '!=',
  gt: '>',
  gteq: '>=',
  lt: '<',
  lteq: '<=',
};

function invalid(): never {
  // Never echo the raw key/payload in errors or logs.
  throw new BadRequestException('Invalid Ransack filter or sort.');
}

function booleanValue(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1')
    return true;
  if (value === false || value === 'false' || value === 0 || value === '0')
    return false;
  return invalid();
}

function scalar(
  value: unknown,
  kind: RansackFieldKind,
): string | number | boolean {
  if (kind === 'boolean') return booleanValue(value);
  if (kind === 'number') {
    if (typeof value !== 'number' && typeof value !== 'string')
      return invalid();
    if (
      typeof value === 'string' &&
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)
    )
      return invalid();
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : invalid();
  }
  if (typeof value !== 'string' || value.length > RANSACK_LIMITS.textLength)
    return invalid();
  if (kind === 'bigint') {
    if (!/^\d{1,19}$/.test(value) || BigInt(value) > 9223372036854775807n)
      return invalid();
  }
  if (
    kind === 'uuid' &&
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  )
    return invalid();
  if (kind === 'date') {
    if (
      !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
        value,
      )
    )
      return invalid();
    const day = value.slice(0, 10);
    const parsedDay = new Date(`${day}T00:00:00Z`);
    if (
      !Number.isFinite(Date.parse(value)) ||
      !Number.isFinite(parsedDay.getTime()) ||
      parsedDay.toISOString().slice(0, 10) !== day
    )
      return invalid();
  }
  return value;
}

function resolveField(
  policy: RansackPolicy,
  field: string,
  alias: string,
): { column: string; kind: RansackFieldKind } {
  if (!Object.hasOwn(policy, field)) return invalid();
  const definition: RansackField = policy[field];
  const kind = typeof definition === 'string' ? definition : definition.kind;
  const column =
    typeof definition === 'string' ? `${alias}.${field}` : definition.column;
  // Column mappings are server-owned identifiers, never arbitrary SQL fragments.
  if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(column)) return invalid();
  return { column, kind };
}

/** Bound the entire request, including domain filters consumed before the common compiler. */
export function validateRansackEnvelope(q: object | undefined): void {
  if (q === undefined) return;
  if (q === null || typeof q !== 'object' || Array.isArray(q)) return invalid();
  const entries: [string, unknown][] = Object.entries(q);
  if (entries.length > RANSACK_LIMITS.conditions) return invalid();
  for (const [key, value] of entries) {
    if (key.length > 128) return invalid();
    if (value === undefined || value === null) continue;
    const list = Array.isArray(value) ? value : [value];
    if (list.length > RANSACK_LIMITS.listItems) return invalid();
    for (const item of list) {
      if (typeof item === 'string' && item.length <= RANSACK_LIMITS.textLength)
        continue;
      if (typeof item === 'number' && Number.isFinite(item)) continue;
      if (typeof item === 'boolean') continue;
      return invalid();
    }
  }
}

/** Apply bounded, parameterized filters using an explicit policy owned by the resource. */
export function applyRansack<T extends object>(
  qb: SelectQueryBuilder<T>,
  q: object | undefined,
  alias: string,
  policy: RansackPolicy,
): SelectQueryBuilder<T> {
  validateRansackEnvelope(q);
  if (q === undefined) return qb;
  const entries: [string, unknown][] = Object.entries(q);

  // Validate everything before modifying the builder. A rejected command has no partial clauses.
  const clauses: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  let sort: { column: string; direction: 'ASC' | 'DESC' } | undefined;
  const existingParams = qb.getParameters();
  let parameterIndex = 0;
  const parameter = (): string => {
    let name: string;
    do {
      name = `ransack_${parameterIndex++}`;
    } while (Object.hasOwn(existingParams, name));
    return name;
  };

  for (const [key, value] of entries) {
    // DTO class fields exist even when the HTTP request omitted them.
    // Undefined is absence; keep validating all explicitly provided keys.
    if (value === undefined) continue;
    if (key === 's') {
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string' || value.length > 128) return invalid();
      const match = /^([a-z_][a-z0-9_]*)(?:\s+(asc|desc))?$/i.exec(
        value.trim(),
      );
      if (!match) return invalid();
      const { column } = resolveField(policy, match[1], alias);
      sort = {
        column,
        direction: match[2]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
      };
      continue;
    }

    const predicate = PREDICATES.find((suffix) => key.endsWith(`_${suffix}`));
    if (!predicate) return invalid();
    const field = key.slice(0, -(predicate.length + 1));
    const { column, kind } = resolveField(policy, field, alias);
    if (value === undefined || value === null || value === '') continue;

    if (predicate === 'null' || predicate === 'not_null') {
      if (booleanValue(value))
        clauses.push({
          sql: `${column} IS ${predicate === 'not_null' ? 'NOT ' : ''}NULL`,
        });
      continue;
    }

    if (predicate === 'in' || predicate === 'not_in') {
      const list = Array.isArray(value) ? value : [value];
      if (list.length > RANSACK_LIMITS.listItems) return invalid();
      if (list.length === 0) {
        if (predicate === 'in') clauses.push({ sql: '1 = 0' });
        continue;
      }
      const values = list.map((item: unknown) => scalar(item, kind));
      const name = parameter();
      clauses.push({
        sql: `${column} ${predicate === 'not_in' ? 'NOT IN' : 'IN'} (:...${name})`,
        params: { [name]: values },
      });
      continue;
    }

    if (
      predicate === 'cont' ||
      predicate === 'not_cont' ||
      predicate === 'start' ||
      predicate === 'end'
    ) {
      if (kind !== 'text') return invalid();
      const text = scalar(value, kind) as string;
      // Use an explicit escape character so %, _ and ! are literal user text.
      const escaped = text.replace(/[!%_]/g, '!$&');
      const pattern = `${predicate === 'start' ? '' : '%'}${escaped}${predicate === 'end' ? '' : '%'}`;
      const name = parameter();
      clauses.push({
        sql: `${column} ${predicate === 'not_cont' ? 'NOT ILIKE' : 'ILIKE'} :${name} ESCAPE '!'`,
        params: { [name]: pattern },
      });
      continue;
    }

    const operator = COMPARISONS[predicate];
    if (!operator) return invalid();
    if (
      predicate !== 'eq' &&
      predicate !== 'not_eq' &&
      kind !== 'number' &&
      kind !== 'date' &&
      kind !== 'bigint'
    )
      return invalid();
    const name = parameter();
    clauses.push({
      sql: `${column} ${operator} :${name}`,
      params: { [name]: scalar(value, kind) },
    });
  }

  for (const clause of clauses) qb.andWhere(clause.sql, clause.params);
  if (sort) qb.addOrderBy(sort.column, sort.direction);
  return qb;
}
