import { describe, expect, it } from 'vitest';
import {
  CompileNodiaAiReportUseCase,
  NodiaAiReportQueryError,
} from './compile-nodia-ai-report.use-case.js';
import { NODIA_AI_REPORT_SOURCES } from '../config/report-sources.js';
import type {
  CompileReportInput,
  ReportSourceRequest,
} from '../types/report-query.types.js';
import type { DataSource, EntityManager } from 'typeorm';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalClock } from '../../rental-common/rental-clock.js';

describe('CompileNodiaAiReportUseCase', () => {
  const compiler = new CompileNodiaAiReportUseCase();
  const registered = NODIA_AI_REPORT_SOURCES.find(
    (source) => source.sourceKey === 'finance_movements',
  )!;
  const source = registered;
  const request = (): ReportSourceRequest => ({
    source_key: source.sourceKey,
    alias: 'expenses',
    scope: {},
    measures: [
      {
        measure_key: 'confirmed_amount',
        aggregation: 'sum',
        output_key: 'total',
      },
    ],
  });
  const input = (
    changes: Partial<CompileReportInput> = {},
  ): CompileReportInput => ({
    request: request(),
    source,
    catalogVersion: 'catalog-fixture',
    scopeSql: 'r.user_id = $1',
    scopeParameters: ['1'],
    scopeFingerprint: 'scope-fixture',
    limits: {
      maxGroups: 100,
      maxFilters: 20,
      maxCollectionItems: 128,
      defaultGroups: 25,
    },
    ...changes,
  });
  const reject = (value: CompileReportInput, code = 'invalid_input') => {
    try {
      compiler.execute(value);
      expect.fail('query should be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(NodiaAiReportQueryError);
      expect(error).toMatchObject({ code });
    }
  };

  it('aggregates the complete filtered snapshot, retains exact text, and binds page lookahead', () => {
    const query = compiler.execute(input());
    expect(query.sql).toContain('WITH filtered AS MATERIALIZED');
    expect(query.sql).toContain('COALESCE(SUM(v0), 0)::text');
    expect(query.sql).toContain(
      'COUNT(*)::text AS matched_records FROM filtered',
    );
    expect(query.sql).toContain('totals AS (SELECT');
    expect(query.sql).not.toContain('SUM(DISTINCT');
    expect(query.parameters).toEqual(['1', 26]);
    expect(query.columns).toEqual([
      {
        output_key: 'total',
        sql_key: 'm0',
        value_type: 'decimal',
        unit: 'peso',
        scale: 0,
        measure_key: 'confirmed_amount',
      },
    ]);
  });

  it('maps all AND any OR without recursive expressions and without interpolating user values', () => {
    const req = request();
    req.filters = {
      all: [
        {
          field_key: 'name',
          operator: 'contains',
          value: "'; DROP TABLE users; --%_",
        },
      ],
      any: [
        { field_key: 'status', operator: 'eq', value: 'paid' },
        { field_key: 'status', operator: 'eq', value: 'pending' },
      ],
    };
    const query = compiler.execute(input({ request: req }));
    expect(query.sql).toContain('strpos(r.name, $2) > 0');
    expect(query.sql).toContain('(r.status = $3) OR (r.status = $4)');
    expect(query.sql).not.toContain('DROP TABLE');
    expect(query.parameters).toEqual([
      '1',
      "'; DROP TABLE users; --%_",
      'paid',
      'pending',
      26,
    ]);
  });

  it('filters one-to-many membership with EXISTS without multiplying base records', () => {
    const req = request();
    req.filters = {
      all: [
        { field_key: 'category_group_id', operator: 'in', values: ['1', '2'] },
      ],
    };
    const query = compiler.execute(input({ request: req }));
    expect(query.sql).toContain(
      'EXISTS (SELECT 1 FROM finance_category_group_memberships fg',
    );
    expect(query.sql).toContain('fg.category_group_id IN ($2, $3)');
    expect(query.sql).not.toContain('JOIN finance_category_group_memberships');
    expect(query.parameters).toEqual(['1', '1', '2', 26]);
  });

  it('preserves false and zero as typed values', () => {
    const product = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'business_products',
    )!;
    const req = {
      source_key: product.sourceKey,
      alias: 'stock',
      scope: {},
      measures: [
        { measure_key: 'records', aggregation: 'count', output_key: 'records' },
      ],
      filters: {
        all: [
          { field_key: 'is_active', operator: 'eq', value: false },
          { field_key: 'stock', operator: 'gte', value: 0 },
        ],
      },
    };
    const query = compiler.execute(
      input({
        source: product,
        request: req,
        scopeSql: 'TRUE',
        scopeParameters: [],
      }),
    );
    expect(query.parameters).toContain(false);
    expect(query.parameters).toContain(0);
  });

  it('applies explicit half-open instant ranges with a valid IANA timezone', () => {
    const req = request();
    req.period = {
      kind: 'instant',
      dimension_key: 'created_at',
      from: '2026-01-01T03:00:00Z',
      to_exclusive: '2026-02-01T03:00:00Z',
      timezone: 'America/Santiago',
    };
    const query = compiler.execute(input({ request: req }));
    expect(query.sql).toContain('r.created_at >= $2 AND r.created_at < $3');
    expect(query.parameters.slice(1, 3)).toEqual([
      req.period.from,
      req.period.to_exclusive,
    ]);
  });

  it('counts base records even when the public measure expression is a nullable field', () => {
    const req = request();
    req.measures = [
      { measure_key: 'records', aggregation: 'count', output_key: 'count' },
    ];
    const query = compiler.execute(input({ request: req }));
    expect(query.sql).toContain('COUNT(*)::text AS m0');
    expect(query.sql).not.toContain('COUNT(v0)');
  });

  it('preserves exact bigint monetary predicates above the JavaScript safe integer range', () => {
    const req = {
      ...request(),
      filters: {
        all: [
          {
            field_key: 'recorded_amount',
            operator: 'gte' as const,
            value: '9007199254740993',
          },
        ],
      },
    };
    const query = compiler.execute(input({ request: req }));
    expect(query.parameters).toContain('9007199254740993');
    for (const value of [
      '-0',
      '01',
      '1.5',
      '9223372036854775808',
      '-9223372036854775809',
      9007199254740992,
    ]) {
      reject(
        input({
          request: {
            ...req,
            filters: {
              all: [{ field_key: 'recorded_amount', operator: 'gte', value }],
            },
          },
        }),
      );
    }
    const negative = compiler.execute(
      input({
        request: {
          ...req,
          filters: {
            all: [
              {
                field_key: 'recorded_amount',
                operator: 'gte',
                value: '-9223372036854775808',
              },
            ],
          },
        },
      }),
    );
    expect(negative.parameters).toContain('-9223372036854775808');
  });

  it('compares instant boundaries without dropping microseconds', () => {
    const period = {
      kind: 'instant',
      dimension_key: 'created_at',
      from: '2026-01-01T00:00:00.000001Z',
      to_exclusive: '2026-01-01T00:00:00.000002Z',
      timezone: 'UTC',
    };
    expect(
      compiler.execute(input({ request: { ...request(), period } })).parameters,
    ).toContain(period.to_exclusive);
    reject(
      input({
        request: {
          ...request(),
          period: {
            ...period,
            from: period.to_exclusive,
            to_exclusive: period.from,
          },
        },
      }),
    );
    reject(
      input({
        request: { ...request(), period: { ...period, timezone: '+01:00' } },
      }),
    );
  });

  it('supports civil calendars only with the actual property timezone and rejects legacy local timestamps', () => {
    const rental = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'rental_expenses',
    )!;
    const period = {
      kind: 'civil_date',
      dimension_key: 'incurred_on',
      from: '2026-01-01',
      to_exclusive: '2026-02-01',
      timezone: 'America/Santiago',
    };
    const req = {
      ...request(),
      source_key: rental.sourceKey,
      period,
      measures: [
        { measure_key: 'amount', aggregation: 'sum', output_key: 'total' },
      ],
    };
    const result = compiler.execute(
      input({
        source: rental,
        request: req,
        sourceTimezone: 'America/Santiago',
      }),
    );
    expect(result.sql).toContain('r.incurred_on >= $2 AND r.incurred_on < $3');
    reject(
      input({ source: rental, request: req, sourceTimezone: 'Europe/Madrid' }),
      'unsupported_semantics',
    );
    const product = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'business_products',
    )!;
    reject(
      input({
        source: product,
        request: {
          ...request(),
          source_key: product.sourceKey,
          measures: [
            {
              measure_key: 'records',
              aggregation: 'count',
              output_key: 'count',
            },
          ],
          period: {
            ...period,
            kind: 'instant',
            dimension_key: 'created_at',
            from: '2026-01-01T00:00:00Z',
            to_exclusive: '2026-02-01T00:00:00Z',
          },
        },
      }),
      'unsupported_semantics',
    );
  });

  it('paginates group keys in native numeric order, serializes bigint groups exactly, and binds cursors', () => {
    const req = request();
    req.group_by = [{ dimension_key: 'category_id', output_key: 'category' }];
    const first = compiler.execute(input({ request: req, pageLimit: 1 }));
    const cursor = compiler.nextCursor(first, { g0: '9007199254740993' });
    const second = compiler.execute(
      input({ request: req, pageLimit: 1, cursor }),
    );
    expect(second.sql).toContain('g0::text AS g0');
    expect(second.sql).toContain('ORDER BY grouped.g0 ASC NULLS LAST');
    expect(second.sql).toContain('g0 > $2 OR g0 IS NULL');
    expect(second.parameters).toContain('9007199254740993');
    reject(
      input({
        request: req,
        pageLimit: 1,
        cursor,
        scopeFingerprint: 'different-owner',
      }),
    );
    reject(
      input({
        request: req,
        pageLimit: 1,
        cursor,
        catalogVersion: 'changed-catalog',
      }),
    );
    const changed = {
      ...req,
      filters: {
        all: [{ field_key: 'status', operator: 'eq' as const, value: 'paid' }],
      },
    };
    reject(input({ request: changed, pageLimit: 1, cursor }));
  });

  it('puts NULL groups last without matching previous nonnull groups again', () => {
    const req = request();
    req.group_by = [
      { dimension_key: 'category_id', output_key: 'category' },
      { dimension_key: 'status', output_key: 'state' },
    ];
    const first = compiler.execute(input({ request: req }));
    const next = compiler.execute(
      input({
        request: req,
        cursor: compiler.nextCursor(first, { g0: null, g1: 'paid' }),
      }),
    );
    expect(next.sql).toContain(
      '(FALSE) OR (g0 IS NOT DISTINCT FROM $2 AND (g1 > $3 OR g1 IS NULL))',
    );
    expect(next.parameters.slice(1, 3)).toEqual([null, 'paid']);
  });

  it.each([
    { sql: 'SELECT * FROM users' },
    { actor: { id: '1' } },
    { sources: [] },
    { combine: 'compare_compatible' },
  ])('rejects unknown source properties %j', (extra) =>
    reject(input({ request: { ...request(), ...extra } })),
  );

  it.each([
    { field_key: 'password', operator: 'eq', value: 'x' },
    { field_key: 'name', operator: 'regex', value: 'x' },
    { field_key: 'category_group_id', operator: 'contains', value: '1' },
    { field_key: 'status', operator: 'eq', value: 'invented' },
  ])('rejects unregistered filter semantics %j', (predicate) =>
    reject(
      input({ request: { ...request(), filters: { all: [predicate] } } }),
      'unsupported_semantics',
    ),
  );

  it.each([
    { field_key: 'category_id', operator: 'eq', value: 1 },
    { field_key: 'category_id', operator: 'eq', value: '9223372036854775808' },
    { field_key: 'category_id', operator: 'eq', value: '01' },
    { field_key: 'category_id', operator: 'in', values: [] },
    { field_key: 'category_id', operator: 'in', values: ['1'], value: '1' },
    { field_key: 'name', operator: 'eq', value: null },
    { field_key: 'name', operator: 'contains', value: '' },
    { field_key: 'name', operator: 'is_null', value: 'false' },
    { field_key: 'name', operator: 'eq', value: 'x', sql: 'TRUE' },
  ])('rejects invalid values and predicate shapes %j', (predicate) =>
    reject(input({ request: { ...request(), filters: { all: [predicate] } } })),
  );

  it.each([
    { from: '2026-02-30T00:00:00Z' },
    { from: '2026-01-01' },
    { from: '2026-03-01T00:00:00Z' },
    { timezone: 'not/a_timezone' },
    { kind: 'civil_date' },
    { to_exclusive: '2026-01-01T00:00:00Z' },
  ])('rejects invalid periods %j', (patch) => {
    const period = {
      kind: 'instant',
      dimension_key: 'created_at',
      from: '2026-01-01T00:00:00Z',
      to_exclusive: '2026-02-01T00:00:00Z',
      timezone: 'America/Santiago',
      ...patch,
    };
    reject(
      input({ request: { ...request(), period } }),
      patch.kind ? 'unsupported_semantics' : 'invalid_input',
    );
  });

  it('rejects currencyless monetary sums, unsupported facturation and mismatched aggregations', () => {
    const currencyless = {
      ...registered,
      measures: {
        ...registered.measures,
        confirmed_amount: {
          ...registered.measures.confirmed_amount,
          descriptor: {
            ...registered.measures.confirmed_amount.descriptor,
            unit: 'money' as const,
            currency: null,
          },
        },
      },
    };
    reject(input({ source: currencyless }), 'unsupported_semantics');
    reject(
      input({
        request: {
          ...request(),
          measures: [
            { measure_key: 'records', aggregation: 'sum', output_key: 'n' },
          ],
        },
      }),
      'unsupported_semantics',
    );
    const invoice = NODIA_AI_REPORT_SOURCES.find(
      (entry) => entry.sourceKey === 'business_invoices',
    )!;
    reject(
      input({
        source: invoice,
        request: {
          ...request(),
          source_key: invoice.sourceKey,
          measures: [
            {
              measure_key: 'invoice_amount',
              aggregation: 'sum',
              output_key: 'n',
            },
          ],
        },
      }),
      'unsupported_semantics',
    );
  });

  it('rejects duplicate output keys and non-groupable relation dimensions', () => {
    reject(
      input({
        request: {
          ...request(),
          group_by: [{ dimension_key: 'status', output_key: 'total' }],
        },
      }),
    );
    reject(
      input({
        request: {
          ...request(),
          group_by: [
            { dimension_key: 'category_group_id', output_key: 'group' },
          ],
        },
      }),
      'unsupported_semantics',
    );
  });

  it('enforces collection, filter, group and cursor limits before compiling SQL', () => {
    reject(input({ pageLimit: 101 }));
    reject(
      input({
        request: {
          ...request(),
          filters: {
            all: Array.from({ length: 21 }, () => ({
              field_key: 'status',
              operator: 'eq',
              value: 'paid',
            })),
          },
        },
      }),
    );
    reject(
      input({
        request: {
          ...request(),
          filters: {
            all: [
              {
                field_key: 'category_id',
                operator: 'in',
                values: Array.from({ length: 129 }, () => '1'),
              },
            ],
          },
        },
      }),
    );
    reject(input({ cursor: 'a'.repeat(16385) }));
    reject(input({ cursor: '%%%' }));
    reject(input({ cursor: Buffer.from('{}').toString('base64url') }));
  });

  it('preserves semantic report errors through the actual native rental transaction boundary', async () => {
    const runner = {
      isTransactionActive: true,
      query: async (sql: string): Promise<unknown[]> =>
        sql.includes('FROM users u JOIN auth_sessions')
          ? [
              {
                actorId: '1',
                sessionId: '00000000-0000-4000-8000-000000000001',
                isSuperAdmin: false,
              },
            ]
          : [],
    };
    const manager = {
      queryRunner: runner,
      query: async (sql: string) => runner.query(sql),
      getRepository: () => ({
        findOne: async () => ({
          id: '1',
          owner_id: '1',
          timezone: 'America/Santiago',
        }),
      }),
    } as unknown as EntityManager;
    const native = new RentalTransactionService(
      {} as DataSource,
      new RentalClock(),
    );
    const error = new NodiaAiReportQueryError(
      'unsupported_semantics',
      'currency',
    );
    await expect(
      native.read(
        {
          userId: '1',
          sessionId: '00000000-0000-4000-8000-000000000001',
          transaction: manager,
        },
        '1',
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toEqual({
      message: 'nodia_ai:unsupported_semantics',
      code: 'unsupported_semantics',
      field: 'currency',
    });
    expect(
      new NodiaAiReportQueryError('invalid_input', 'cursor').getStatus(),
    ).toBe(400);
  });
});
