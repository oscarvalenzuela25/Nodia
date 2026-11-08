import { HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  ReportFieldDefinition,
  ReportValueType,
} from '../types/report-source.types.js';
import type {
  CompileReportInput,
  CompiledReportQuery,
  CompiledReportColumn,
  ReportSourceRequest,
  ReportScalar,
} from '../types/report-query.types.js';

export class NodiaAiReportQueryError extends HttpException {
  constructor(
    readonly code:
      'invalid_input' | 'unsupported_semantics' | 'needs_clarification',
    readonly field: string,
  ) {
    super(
      { message: `nodia_ai:${code}`, code, field },
      code === 'invalid_input' ? 400 : 422,
    );
  }
}
type RecordValue = Record<string, unknown>;
const fail = (field: string): never => {
  throw new NodiaAiReportQueryError('invalid_input', field);
};
const unsupported = (field: string): never => {
  throw new NodiaAiReportQueryError('unsupported_semantics', field);
};
function object(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
  path: string,
): RecordValue {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return fail(path);
  const result = value as RecordValue;
  if (
    Object.keys(result).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(result, key))
  )
    return fail(path);
  return result;
}
function text(value: unknown, path: string): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    Buffer.byteLength(value) > 1024
  )
    return fail(path);
  return value;
}
function list(value: unknown, max: number, path: string, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    return fail(path);
  return value;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as RecordValue)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
function validDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000-')
  )
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
function validInstant(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  return (
    validDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value)) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60
  );
}
function instantMicros(value: string): bigint {
  const fraction = /\.(\d{1,6})/.exec(value)?.[1] ?? '';
  return (
    BigInt(Date.parse(value.replace(/\.\d{1,6}/, ''))) * 1000n +
    BigInt(fraction.padEnd(6, '0'))
  );
}
function scalar(
  value: unknown,
  type: ReportValueType | 'aggregate_integer' | 'aggregate_decimal',
  path: string,
): ReportScalar {
  switch (type) {
    case 'aggregate_decimal':
      if (
        typeof value === 'string' &&
        /^(?:0|-?[1-9]\d{0,127})(?:\.\d{1,3})?$/.test(value)
      )
        return value;
      return fail(path);
    case 'aggregate_integer':
      if (typeof value === 'string' && /^(?:0|-?[1-9]\d{0,127})$/.test(value))
        return value;
      return fail(path);
    case 'string':
      if (typeof value === 'string' && Buffer.byteLength(value) <= 1024)
        return value;
      return fail(path);
    case 'bigint_id':
      if (
        typeof value === 'string' &&
        /^[1-9]\d{0,18}$/.test(value) &&
        BigInt(value) <= 9223372036854775807n
      )
        return value;
      return fail(path);
    case 'bigint_integer':
      if (
        typeof value === 'string' &&
        /^(?:0|-?[1-9]\d{0,18})$/.test(value) &&
        BigInt(value) >= -9223372036854775808n &&
        BigInt(value) <= 9223372036854775807n
      )
        return value;
      return fail(path);
    case 'uuid':
      if (
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        )
      )
        return value;
      return fail(path);
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return fail(path);
    case 'integer':
      if (typeof value === 'number' && Number.isSafeInteger(value))
        return value;
      return fail(path);
    case 'date':
      if (validDate(value)) return value;
      return fail(path);
    case 'datetime':
      if (validInstant(value)) return value;
      return fail(path);
  }
}
function field(
  source: CompileReportInput['source'],
  key: string,
): ReportFieldDefinition {
  if (!Object.hasOwn(source.fields, key)) return unsupported('field_key');
  return source.fields[key];
}
function dimensionType(
  type: ReportValueType,
): CompiledReportColumn['value_type'] {
  return type === 'boolean'
    ? 'boolean'
    : type === 'integer'
      ? 'number'
      : type === 'bigint_integer'
        ? 'decimal'
        : type === 'date'
          ? 'date'
          : type === 'datetime'
            ? 'instant'
            : 'text';
}

/** Compiles only registered SQL mappings. It does not authorize or perform I/O. */
@Injectable()
export class CompileNodiaAiReportUseCase {
  execute(input: CompileReportInput): CompiledReportQuery {
    const { source, limits } = input;
    for (const limit of Object.values(limits))
      if (!Number.isSafeInteger(limit) || limit < 1) fail('limits');
    const pageLimit = input.pageLimit ?? limits.defaultGroups;
    if (
      !Number.isSafeInteger(pageLimit) ||
      pageLimit < 1 ||
      pageLimit > limits.maxGroups
    )
      fail('page_limit');
    const request = object(
      input.request,
      [
        'source_key',
        'alias',
        'scope',
        'filters',
        'period',
        'measures',
        'group_by',
        'order_by',
      ],
      ['source_key', 'alias', 'scope', 'measures'],
      'source',
    );
    if (text(request.source_key, 'source_key') !== source.sourceKey)
      unsupported('source_key');
    text(request.alias, 'alias');
    const scope = object(
      request.scope,
      ['subject_user_id', 'business_id', 'property_id', 'provider_id'],
      [],
      'scope',
    );
    for (const [key, value] of Object.entries(scope))
      scalar(
        value,
        key === 'business_id' ? 'uuid' : 'bigint_id',
        `scope.${key}`,
      );
    const parameters: unknown[] = [...input.scopeParameters];
    const bind = (value: unknown): string => {
      parameters.push(value);
      return `$${parameters.length}`;
    };
    const predicates = [...source.basePredicatesSql, input.scopeSql];
    const fixedDimensions = new Set<string>();
    if (request.filters !== undefined) {
      const filters = object(request.filters, ['all', 'any'], [], 'filters');
      const all =
        filters.all === undefined
          ? []
          : list(filters.all, limits.maxFilters, 'filters.all');
      const any =
        filters.any === undefined
          ? []
          : list(filters.any, limits.maxFilters, 'filters.any');
      if (all.length + any.length > limits.maxFilters) fail('filters');
      const compilePredicate = (raw: unknown): string => {
        const p = object(
          raw,
          ['field_key', 'operator', 'value', 'values'],
          ['field_key', 'operator'],
          'predicate',
        );
        const f = field(source, text(p.field_key, 'field_key'));
        if (f.descriptor.temporal_kind === 'local_datetime')
          unsupported('field_key');
        const op = text(p.operator, 'operator');
        if (!f.descriptor.allowed_operators.some((allowed) => allowed === op))
          unsupported('operator');
        const expression = f.expressionSql;
        let sql: string;
        if (op === 'in') {
          if (Object.hasOwn(p, 'value') || !Object.hasOwn(p, 'values'))
            fail('predicate');
          const values = list(
            p.values,
            limits.maxCollectionItems,
            'values',
            1,
          ).map((value) => scalar(value, f.descriptor.value_type, 'values'));
          if (
            f.descriptor.values &&
            values.some(
              (value) => !f.descriptor.values!.includes(String(value)),
            )
          )
            unsupported('values');
          sql = `${expression} IN (${values.map(bind).join(', ')})`;
        } else {
          if (!Object.hasOwn(p, 'value') || Object.hasOwn(p, 'values'))
            fail('predicate');
          if (op === 'is_null') {
            if (typeof p.value !== 'boolean') fail('value');
            sql = `${expression} IS ${p.value ? '' : 'NOT '}NULL`;
          } else {
            const value = scalar(p.value, f.descriptor.value_type, 'value');
            if (
              f.descriptor.values &&
              !f.descriptor.values.includes(String(value))
            )
              unsupported('value');
            if (op === 'contains') {
              if (f.descriptor.value_type !== 'string') unsupported('operator');
              if (typeof value !== 'string' || !value.length) fail('value');
              sql = `strpos(${expression}, ${bind(value)}) > 0`;
            } else {
              const operators: Record<string, string> = {
                eq: '=',
                neq: '<>',
                lt: '<',
                lte: '<=',
                gt: '>',
                gte: '>=',
              };
              if (!Object.hasOwn(operators, op)) unsupported('operator');
              sql = `${expression} ${operators[op]} ${bind(value)}`;
            }
          }
        }
        return f.existsSql
          ? `EXISTS (SELECT 1 FROM ${f.existsSql.fromSql} WHERE (${f.existsSql.correlationSql}) AND (${sql}))`
          : `(${sql})`;
      };
      predicates.push(...all.map(compilePredicate));
      for (const raw of all) {
        const predicate = raw as RecordValue;
        if (
          predicate.operator === 'eq' &&
          typeof predicate.field_key === 'string'
        )
          fixedDimensions.add(predicate.field_key);
      }
      if (any.length)
        predicates.push(`(${any.map(compilePredicate).join(' OR ')})`);
    }
    if (request.period !== undefined) {
      const period = object(
        request.period,
        ['kind', 'dimension_key', 'from', 'to_exclusive', 'timezone'],
        ['kind', 'dimension_key', 'from', 'to_exclusive', 'timezone'],
        'period',
      );
      const f = field(source, text(period.dimension_key, 'dimension_key'));
      const timezone = text(period.timezone, 'timezone');
      if (!/^[A-Za-z][A-Za-z0-9_+\-/]*$/.test(timezone)) fail('timezone');
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0);
      } catch {
        fail('timezone');
      }
      if (f.existsSql || f.descriptor.temporal_kind === 'local_datetime')
        unsupported('period');
      if (period.kind === 'civil_date') {
        if (input.sourceTimezone && timezone !== input.sourceTimezone)
          unsupported('timezone');
        if (f.descriptor.temporal_kind !== 'civil_date')
          unsupported('period.kind');
        if (
          !validDate(period.from) ||
          !validDate(period.to_exclusive) ||
          period.from >= period.to_exclusive
        )
          fail('period');
      } else if (period.kind === 'instant') {
        if (f.descriptor.temporal_kind !== 'instant')
          unsupported('period.kind');
        if (
          !validInstant(period.from) ||
          !validInstant(period.to_exclusive) ||
          instantMicros(period.from) >= instantMicros(period.to_exclusive)
        )
          fail('period');
      } else fail('period.kind');
      predicates.push(
        `(${f.expressionSql} >= ${bind(period.from)} AND ${f.expressionSql} < ${bind(period.to_exclusive)})`,
      );
    }
    const columns: CompiledReportColumn[] = [];
    const projections: string[] = [];
    const groupKeys: string[] = [];
    const groupTypes: ReportValueType[] = [];
    const groups =
      request.group_by === undefined
        ? []
        : list(request.group_by, limits.maxCollectionItems, 'group_by');
    const outputKeys = new Set<string>();
    const outputKey = (value: unknown): string => {
      const key = text(value, 'output_key');
      if (outputKeys.has(key)) fail('output_key');
      outputKeys.add(key);
      return key;
    };
    const usedDimensions = new Set<string>();
    groups.forEach((raw, index) => {
      const group = object(
        raw,
        ['dimension_key', 'output_key'],
        ['dimension_key', 'output_key'],
        'group_by',
      );
      const key = text(group.dimension_key, 'dimension_key');
      const f = field(source, key);
      if (
        !f.descriptor.dimension_key ||
        f.existsSql ||
        f.descriptor.temporal_kind === 'local_datetime' ||
        usedDimensions.has(key)
      )
        unsupported('group_by');
      usedDimensions.add(key);
      const alias = `g${index}`;
      groupKeys.push(alias);
      groupTypes.push(f.descriptor.value_type);
      projections.push(`${f.expressionSql} AS ${alias}`);
      columns.push({
        output_key: outputKey(group.output_key),
        sql_key: alias,
        value_type: dimensionType(f.descriptor.value_type),
        unit: null,
        scale: null,
      });
    });
    const omittedTotalKeys: string[] = [];
    const aggregates = list(
      request.measures,
      limits.maxCollectionItems,
      'measures',
      1,
    ).map((raw, index) => {
      const measure = object(
        raw,
        ['measure_key', 'aggregation', 'output_key'],
        ['measure_key', 'aggregation', 'output_key'],
        'measure',
      );
      const key = text(measure.measure_key, 'measure_key');
      if (!Object.hasOwn(source.measures, key)) unsupported('measure_key');
      const m = source.measures[key];
      const aggregation = measure.aggregation;
      if (
        !m.descriptor.supported ||
        !m.descriptor.aggregations.some((allowed) => allowed === aggregation)
      )
        unsupported('measure_key');
      if (
        aggregation === 'sum' &&
        m.descriptor.unit === 'money' &&
        !m.descriptor.currency
      )
        unsupported('currency');
      const alias = `m${index}`;
      if (m.requiredDimensionKey) {
        if (
          !usedDimensions.has(m.requiredDimensionKey) &&
          !fixedDimensions.has(m.requiredDimensionKey)
        )
          unsupported('measurement_unit');
        omittedTotalKeys.push(alias);
      }
      projections.push(`${m.expressionSql} AS v${index}`);
      columns.push({
        output_key: outputKey(measure.output_key),
        sql_key: alias,
        value_type: 'decimal',
        unit:
          m.descriptor.unit === 'money'
            ? m.descriptor.currency
            : m.descriptor.unit,
        scale: m.descriptor.scale,
        measure_key: key,
      });
      return `${aggregation === 'count' ? 'COUNT(*)' : `COALESCE(SUM(v${index}), 0)`}::text AS ${alias}`;
    });
    const typedRequest = request as unknown as ReportSourceRequest;
    const cursorOrder: CompiledReportQuery['cursorOrder'] = [];
    if (request.order_by !== undefined) {
      if (!groupKeys.length) unsupported('order_by');
      const seen = new Set<string>();
      for (const raw of list(
        request.order_by,
        limits.maxCollectionItems,
        'order_by',
        1,
      )) {
        const order = object(
          raw,
          ['output_key', 'direction'],
          ['output_key', 'direction'],
          'order_by',
        );
        const key = text(order.output_key, 'order_by.output_key');
        const column = columns.find((item) => item.output_key === key);
        if (!column) return fail('order_by');
        if (
          !column ||
          seen.has(key) ||
          (order.direction !== 'asc' && order.direction !== 'desc')
        )
          fail('order_by');
        seen.add(key);
        const groupIndex = groupKeys.indexOf(column.sql_key);
        cursorOrder.push({
          key: column.sql_key,
          type: column.measure_key
            ? column.scale === 3
              ? 'aggregate_decimal'
              : 'aggregate_integer'
            : groupTypes[groupIndex],
          direction: order.direction as 'asc' | 'desc',
          aggregate: column.measure_key !== undefined,
        });
      }
    }
    // Dimensions complete every ranking's order, so tied totals cannot skip/duplicate groups.
    groupKeys.forEach((key, index) => {
      if (!cursorOrder.some((item) => item.key === key))
        cursorOrder.push({
          key,
          type: groupTypes[index],
          direction: 'asc',
          aggregate: false,
        });
    });
    const orderExpression = (
      item: CompiledReportQuery['cursorOrder'][number],
    ) =>
      item.aggregate ? `grouped.${item.key}::numeric` : `grouped.${item.key}`;
    const cursorExpression = (
      item: CompiledReportQuery['cursorOrder'][number],
    ) => (item.aggregate ? `${item.key}::numeric` : item.key);
    const queryFingerprint = createHash('sha256')
      .update(
        canonical({
          request,
          catalog: input.catalogVersion,
          scope: input.scopeFingerprint,
          pageLimit,
        }),
      )
      .digest('hex');
    let after = '';
    if (input.cursor !== undefined) {
      const cursor = this.decodeCursor(
        input.cursor,
        queryFingerprint,
        cursorOrder.map((item) => item.type),
      );
      const branches = cursor.map((value, index) => {
        const equal = cursor
          .slice(0, index)
          .map(
            (previous, previousIndex) =>
              `${cursorExpression(cursorOrder[previousIndex])} IS NOT DISTINCT FROM ${bind(previous)}`,
          );
        const greater =
          value === null
            ? 'FALSE'
            : `(${cursorExpression(cursorOrder[index])} ${cursorOrder[index].direction === 'desc' ? '<' : '>'} ${bind(value)} OR ${cursorExpression(cursorOrder[index])} IS NULL)`;
        return `(${[...equal, greater].join(' AND ')})`;
      });
      after = ` WHERE (${branches.join(' OR ')})`;
    }
    const ordering = cursorOrder.length
      ? ` ORDER BY ${cursorOrder.map((item) => `${orderExpression(item)} ${item.direction.toUpperCase()} NULLS LAST`).join(', ')}`
      : '';
    const grouped = `${groupKeys.length ? `${groupKeys.join(', ')}, ` : ''}${aggregates.join(', ')}`;
    const groupBy = groupKeys.length ? ` GROUP BY ${groupKeys.join(', ')}` : '';
    const pageProjection = [
      ...groupKeys.map((key, index) =>
        ['bigint_id', 'bigint_integer'].includes(groupTypes[index])
          ? `${key}::text AS ${key}`
          : groupTypes[index] === 'datetime'
            ? `to_char(${key} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ${key}`
            : key,
      ),
      ...aggregates.map((_, index) => `m${index}`),
    ].join(', ');
    const totalProjection = aggregates.filter(
      (_, index) => !omittedTotalKeys.includes(`m${index}`),
    );
    const sql = `WITH filtered AS MATERIALIZED (SELECT ${projections.join(', ')} FROM ${source.fromSql} WHERE ${predicates.map((p) => `(${p})`).join(' AND ')}), totals AS (SELECT ${totalProjection.length ? totalProjection.join(', ') + ', ' : ''}COUNT(*)::text AS matched_records FROM filtered), grouped AS (SELECT ${grouped} FROM filtered${groupBy}), page AS (SELECT ${pageProjection}, row_number() OVER (${ordering.trim()}) AS __order FROM grouped${after}${ordering} LIMIT ${bind(pageLimit + 1)}) SELECT COALESCE((SELECT jsonb_agg(to_jsonb(page) - '__order' ORDER BY __order) FROM page), '[]'::jsonb) AS rows, to_jsonb(totals) - 'matched_records' AS totals, totals.matched_records FROM totals`;
    return {
      sql,
      parameters,
      request: typedRequest,
      columns,
      queryFingerprint,
      pageLimit,
      groupKeys,
      groupTypes,
      cursorOrder,
      ...(omittedTotalKeys.length ? { omittedTotalKeys } : {}),
    };
  }

  nextCursor(
    query: CompiledReportQuery,
    lastRow: Record<string, unknown>,
  ): string {
    if (!query.groupKeys.length) fail('cursor');
    const values = query.cursorOrder.map(({ key, type }) =>
      lastRow[key] === null ? null : scalar(lastRow[key], type, 'cursor'),
    );
    const cursor = Buffer.from(
      JSON.stringify({ v: 1, query: query.queryFingerprint, values }),
    ).toString('base64url');
    if (cursor.length > 16384) fail('cursor');
    return cursor;
  }

  private decodeCursor(
    cursor: string,
    hash: string,
    types: readonly (
      ReportValueType | 'aggregate_integer' | 'aggregate_decimal'
    )[],
  ): ReportScalar[] {
    if (
      !types.length ||
      typeof cursor !== 'string' ||
      cursor.length > 16384 ||
      !/^[A-Za-z0-9_-]+$/.test(cursor)
    )
      return fail('cursor');
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      return fail('cursor');
    }
    const value = object(
      parsed,
      ['v', 'query', 'values'],
      ['v', 'query', 'values'],
      'cursor',
    );
    if (value.v !== 1 || value.query !== hash) return fail('cursor');
    const values = list(value.values, types.length, 'cursor');
    if (values.length !== types.length) return fail('cursor');
    return values.map((item, index) =>
      item === null ? null : scalar(item, types[index], 'cursor'),
    );
  }
}
