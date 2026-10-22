import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { RunNodiaAiReportUseCase } from './run-nodia-ai-report.use-case.js';
import { CompileNodiaAiReportUseCase } from './compile-nodia-ai-report.use-case.js';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiAuthorizationService } from '../../nodia-ai/nodia-ai-authorization.service.js';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalClock } from '../../rental-common/rental-clock.js';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { RentalCollaborator } from '../../rental-collaborator/entities/rental-collaborator.entity.js';
import { User } from '../../user/entities/user.entity.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import type { ReportSourceRequest } from '../types/report-query.types.js';

const identity = {
  userId: '9007199254740993',
  sessionId: '11111111-1111-4111-8111-111111111111',
};
const businessId = '22222222-2222-4222-8222-222222222222';
const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
  policyEnvelope(),
);
const registry = new NodiaAiReportRegistryUseCase(policy);
function fixture(resultBytes = policy.results.tool_result_utf8_bytes) {
  const state = {
    output: [
      {
        rows: [{ m0: '18014398509481986' }],
        totals: { m0: '18014398509481986' },
        matched_records: '2',
      },
    ] as unknown,
    sqlError: null as Error | null,
    nativeSession: true,
    businessExists: true,
    providerExists: true,
    collaborator: true,
    propertyOwner: '2',
    propertyTimezone: 'America/Santiago' as string | null,
    isolation: 'read committed',
    snapshot: {
      actorId: identity.userId,
      sessionId: identity.sessionId,
      isSuperAdmin: false,
      actionKeys: [],
      modules: [
        { id: '1', key: 'nodia_ai', route: '/tools/nodia-ai', assigned: true },
        {
          id: '2',
          key: 'personal_finance',
          route: '/tools/finances-personal',
          assigned: true,
        },
        {
          id: '3',
          key: 'businesses',
          route: '/tools/business',
          assigned: true,
        },
        {
          id: '4',
          key: 'rental_reservations',
          route: '/tools/reservations',
          assigned: true,
        },
      ],
    },
  };
  const query = vi.fn(async (sql: string, _parameters?: unknown[]) => {
    if (sql === 'SHOW transaction_isolation')
      return [{ transaction_isolation: state.isolation }];
    if (sql.startsWith('WITH filtered')) {
      if (state.sqlError) throw state.sqlError;
      return state.output;
    }
    if (sql.startsWith('SELECT u.id::text'))
      return state.nativeSession
        ? [
            {
              actorId: identity.userId,
              sessionId: identity.sessionId,
              isSuperAdmin: state.snapshot.isSuperAdmin,
            },
          ]
        : [];
    if (sql.startsWith('SELECT EXISTS(SELECT 1 FROM users'))
      return [{ exists: true }];
    if (sql.startsWith('SELECT id FROM businesses'))
      return state.businessExists ? [{ id: businessId }] : [];
    if (sql.startsWith('SELECT id::text FROM providers'))
      return state.providerExists ? [{ id: '3' }] : [];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true, query },
    getRepository(entity: unknown) {
      if (entity === RentalProperty)
        return {
          findOne: vi.fn(async () => ({
            id: '7',
            owner_id: state.propertyOwner,
            timezone: state.propertyTimezone,
          })),
        };
      if (entity === User)
        return { findOne: vi.fn(async () => ({ id: identity.userId })) };
      if (entity === RentalCollaborator)
        return { existsBy: vi.fn(async () => state.collaborator) };
      throw Error('Unexpected synthetic repository');
    },
  } as unknown as EntityManager;
  const load = vi.fn(async () => state.snapshot);
  const authorize = new AuthorizeNodiaAiUseCase({
    loadCurrentActor: load,
  } as unknown as NodiaAiAuthorizationService);
  const transaction = vi.fn(
    async (
      _level: string,
      work: (manager: EntityManager) => Promise<unknown>,
    ) => work(manager),
  );
  const dataSource = { transaction } as unknown as DataSource;
  const compiler = new CompileNodiaAiReportUseCase();
  const useCase = new RunNodiaAiReportUseCase(
    dataSource,
    registry,
    compiler,
    authorize,
    new RentalTransactionService(dataSource, new RentalClock()),
    {
      ...policy,
      results: { ...policy.results, tool_result_utf8_bytes: resultBytes },
    },
  );
  const request = (changes: Partial<ReportSourceRequest> = {}) => ({
    catalog_version: registry.catalogVersion,
    combine: 'separate',
    sources: [
      {
        source_key: 'finance_movements',
        alias: 'expenses',
        scope: {},
        measures: [
          {
            measure_key: 'confirmed_amount',
            aggregation: 'sum',
            output_key: 'total',
          },
        ],
        ...changes,
      },
    ],
  });
  return {
    state,
    query,
    manager,
    load,
    transaction,
    useCase,
    request,
    business: () =>
      request({
        source_key: 'business_invoices',
        scope: { business_id: businessId },
        measures: [
          { measure_key: 'records', aggregation: 'count', output_key: 'count' },
        ],
      }),
  };
}

describe('RunNodiaAiReportUseCase', () => {
  it('uses current native owner authority, exact bigint totals and one statement for rows and total', async () => {
    const f = fixture();
    const result = await f.useCase.execute(identity, f.request());
    expect(result).toMatchObject({
      status: 'ok',
      scope: { subject_user_id: identity.userId },
      totals: { total: '18014398509481986' },
      matched_records: '2',
      rows: [['18014398509481986']],
      basis_key: 'created_at',
    });
    expect(result.columns[0]).toMatchObject({ unit: 'peso', scale: 0 });
    const reads = f.query.mock.calls.filter(([sql]) =>
      sql.startsWith('WITH filtered'),
    );
    expect(reads).toHaveLength(1);
    expect(reads[0][1]?.[0]).toBe(identity.userId);
    expect(f.query.mock.calls[2][0]).toMatch(/^LOCK TABLE/);
    expect(f.load.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.query.mock.invocationCallOrder[2],
    );
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(
      /WITH filtered|expressionSql|sessionId|actorId/,
    );
  });
  it('rejects destination revocation before querying report/domain data', async () => {
    const f = fixture();
    f.state.snapshot.modules[1].assigned = false;
    await expect(f.useCase.execute(identity, f.request())).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
    expect(
      f.query.mock.calls.every(
        ([sql]) =>
          sql.startsWith('SET LOCAL') ||
          sql.startsWith('LOCK TABLE') ||
          sql === 'SHOW transaction_isolation',
      ),
    ).toBe(true);
  });
  it('rechecks native session revocation after logical authorization', async () => {
    const f = fixture();
    f.state.nativeSession = false;
    await expect(f.useCase.execute(identity, f.request())).rejects.toThrow(
      'auth:session_expired',
    );
    expect(
      f.query.mock.calls.some(([sql]) => sql.startsWith('WITH filtered')),
    ).toBe(false);
  });
  it('rejects an ordinary user requesting another financial owner and allows a current super_admin', async () => {
    const f = fixture();
    const input = f.request({ scope: { subject_user_id: '2' } });
    await expect(f.useCase.execute(identity, input)).rejects.toThrow(
      'finance:scope_denied',
    );
    expect(
      f.query.mock.calls.some(([sql]) => sql.startsWith('WITH filtered')),
    ).toBe(false);
    f.state.snapshot.isSuperAdmin = true;
    expect(
      (await f.useCase.execute(identity, input)).scope.subject_user_id,
    ).toBe('2');
  });
  it('requires explicit business/rental scope and rejects unrelated scope keys', async () => {
    const f = fixture();
    await expect(
      f.useCase.execute(
        identity,
        f.request({ source_key: 'business_products' }),
      ),
    ).rejects.toMatchObject({
      code: 'needs_clarification',
      field: 'scope.business_id',
    });
    await expect(
      f.useCase.execute(identity, f.request({ source_key: 'rental_payments' })),
    ).rejects.toMatchObject({
      code: 'needs_clarification',
      field: 'scope.property_id',
    });
    await expect(
      f.useCase.execute(identity, f.request({ scope: { provider_id: '3' } })),
    ).rejects.toMatchObject({ code: 'unsupported_semantics', field: 'scope' });
    expect(
      f.query.mock.calls.some(([sql]) => sql.startsWith('WITH filtered')),
    ).toBe(false);
  });
  it('does not invent invoice currency; count works and monetary sum is rejected', async () => {
    const f = fixture();
    f.state.output = [
      { rows: [{ m0: '2' }], totals: { m0: '2' }, matched_records: '2' },
    ];
    const input = f.business();
    expect((await f.useCase.execute(identity, input)).columns[0].unit).toBe(
      'count',
    );
    input.sources[0].measures = [
      {
        measure_key: 'invoice_amount',
        aggregation: 'sum',
        output_key: 'amount',
      },
    ];
    await expect(f.useCase.execute(identity, input)).rejects.toMatchObject({
      code: 'unsupported_semantics',
      field: 'measure_key',
    });
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('WITH filtered')),
    ).toHaveLength(1);
  });
  it('verifies business and provider existence before report execution', async () => {
    const f = fixture();
    f.state.businessExists = false;
    await expect(f.useCase.execute(identity, f.business())).rejects.toThrow(
      'business:not_found',
    );
    f.state.businessExists = true;
    f.state.providerExists = false;
    const input = f.business();
    input.sources[0].scope.provider_id = '3';
    await expect(f.useCase.execute(identity, input)).rejects.toThrow(
      'provider:not_found',
    );
    expect(
      f.query.mock.calls.some(([sql]) => sql.startsWith('WITH filtered')),
    ).toBe(false);
  });
  it('uses the actual rental collaborator boundary and sees current collaborator revocation', async () => {
    const f = fixture();
    const input = f.request({
      source_key: 'rental_payments',
      scope: { property_id: '7' },
      measures: [
        { measure_key: 'amount', aggregation: 'sum', output_key: 'total' },
      ],
    });
    expect((await f.useCase.execute(identity, input)).columns[0].unit).toBe(
      'CLP',
    );
    f.state.collaborator = false;
    await expect(f.useCase.execute(identity, input)).rejects.toThrow(
      'rental:not_found',
    );
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('WITH filtered')),
    ).toHaveLength(1);
  });
  it('enforces property civil timezone and records the actual requested temporal basis', async () => {
    const f = fixture();
    const request = {
      source_key: 'rental_expenses',
      scope: { property_id: '7' },
      measures: [
        {
          measure_key: 'paid_amount',
          aggregation: 'sum' as const,
          output_key: 'total',
        },
      ],
      period: {
        kind: 'civil_date' as const,
        dimension_key: 'paid_on',
        from: '2026-10-01',
        to_exclusive: '2026-11-01',
        timezone: 'America/Santiago',
      },
    };
    expect(
      (await f.useCase.execute(identity, f.request(request))).basis_key,
    ).toBe('paid_on');
    request.period.timezone = 'UTC';
    await expect(
      f.useCase.execute(identity, f.request(request)),
    ).rejects.toMatchObject({
      code: 'unsupported_semantics',
      field: 'timezone',
    });
  });
  it('asks for the missing property calendar timezone before civil-period SQL and permits a report without a period', async () => {
    const f = fixture();
    f.state.propertyTimezone = null;
    const request: Partial<ReportSourceRequest> = {
      source_key: 'rental_expenses',
      scope: { property_id: '7' },
      measures: [
        { measure_key: 'paid_amount', aggregation: 'sum', output_key: 'total' },
      ],
      period: {
        kind: 'civil_date',
        dimension_key: 'paid_on',
        from: '2026-10-01',
        to_exclusive: '2026-11-01',
        timezone: 'America/Santiago',
      },
    };
    await expect(
      f.useCase.execute(identity, f.request(request)),
    ).rejects.toMatchObject({
      code: 'needs_clarification',
      field: 'property.timezone',
    });
    expect(
      f.query.mock.calls.some(([sql]) => sql.startsWith('WITH filtered')),
    ).toBe(false);
    delete request.period;
    expect(
      (await f.useCase.execute(identity, f.request(request))).period,
    ).toBeNull();
  });
  it('preserves zero totals and false dimensions as observable data', async () => {
    const f = fixture();
    f.state.output = [
      {
        rows: [{ g0: false, m0: '0' }],
        totals: { m0: '0' },
        matched_records: '1',
      },
    ];
    const result = await f.useCase.execute(
      identity,
      f.request({
        group_by: [{ dimension_key: 'is_active', output_key: 'active' }],
      }),
    );
    expect(result.rows).toEqual([[false, '0']]);
    expect(result.totals).toEqual({ total: '0' });
    expect(result.status).toBe('ok');
  });
  it('paginates groups without replacing full-population totals with the current page', async () => {
    const f = fixture();
    f.state.output = [
      {
        rows: [
          { g0: false, m0: '0' },
          { g0: true, m0: '10' },
        ],
        totals: { m0: '10' },
        matched_records: '2',
      },
    ];
    const request = {
      ...f.request({
        group_by: [{ dimension_key: 'is_active', output_key: 'active' }],
      }),
      page_limit: 1,
    };
    const first = await f.useCase.execute(identity, request);
    expect(first).toMatchObject({
      rows: [[false, '0']],
      totals: { total: '10' },
      matched_records: '2',
      group_page_complete: false,
    });
    expect(first.next_cursor).toBeTypeOf('string');
    f.state.output = [
      {
        rows: [{ g0: true, m0: '10' }],
        totals: { m0: '10' },
        matched_records: '2',
      },
    ];
    const second = await f.useCase.execute(identity, {
      ...request,
      cursor: first.next_cursor,
    });
    expect(second).toMatchObject({
      rows: [[true, '10']],
      totals: { total: '10' },
      group_page_complete: true,
      next_cursor: null,
    });
  });
  it.each(['2026-02-30', 'not-a-date'])(
    'rejects invalid civil SQL date %s',
    async (date) => {
      const f = fixture();
      f.state.output = [
        {
          rows: [{ g0: date, m0: '1' }],
          totals: { m0: '1' },
          matched_records: '1',
        },
      ];
      const input = f.request({
        source_key: 'rental_payments',
        scope: { property_id: '7' },
        measures: [
          { measure_key: 'records', aggregation: 'count', output_key: 'count' },
        ],
        group_by: [{ dimension_key: 'occurred_on', output_key: 'day' }],
      });
      await expect(f.useCase.execute(identity, input)).rejects.toThrow(
        'rental:server_error',
      );
    },
  );
  it('rejects an invalid instant SQL value without exposing the raw result', async () => {
    const f = fixture();
    f.state.output = [
      {
        rows: [{ g0: '2026-02-30T10:00:00Z', m0: '1' }],
        totals: { m0: '1' },
        matched_records: '1',
      },
    ];
    await expect(
      f.useCase.execute(
        identity,
        f.request({
          group_by: [{ dimension_key: 'created_at', output_key: 'created' }],
        }),
      ),
    ).rejects.toThrow('nodia_ai:report_unavailable');
  });
  it.each(['row', 'total'])(
    'rejects fractional scale-zero financial %s instead of rounding',
    async (location) => {
      const f = fixture();
      f.state.output = [
        {
          rows: [{ m0: location === 'row' ? '1.5' : '1' }],
          totals: { m0: location === 'total' ? '1.5' : '1' },
          matched_records: '1',
        },
      ];
      await expect(f.useCase.execute(identity, f.request())).rejects.toThrow(
        'nodia_ai:report_unavailable',
      );
    },
  );
  it('distinguishes an empty authorized population from unavailable SQL', async () => {
    const f = fixture();
    f.state.output = [
      { rows: [{ m0: '0' }], totals: { m0: '0' }, matched_records: '0' },
    ];
    expect(await f.useCase.execute(identity, f.request())).toMatchObject({
      status: 'empty',
      matched_records: '0',
      totals: { total: '0' },
    });
    f.state.sqlError = Error('private SQL SELECT secret_column FROM secrets');
    await expect(f.useCase.execute(identity, f.request())).rejects.toThrow(
      'nodia_ai:report_unavailable',
    );
  });
  it('enforces the backend-owned result byte ceiling instead of truncating a report', async () => {
    const f = fixture(64);
    await expect(
      f.useCase.execute(identity, f.request()),
    ).rejects.toMatchObject({
      code: 'unsupported_semantics',
      field: 'result_limit',
    });
    expect(
      f.query.mock.calls.filter(([sql]) => sql.startsWith('WITH filtered')),
    ).toHaveLength(1);
  });
  it.each([
    null,
    [],
    [{ rows: [], totals: {}, matched_records: '0', secret: 'hidden' }],
    [{ rows: [{ m0: 10 }], totals: { m0: '10' }, matched_records: '1' }],
    [{ rows: [], totals: { m0: 'NaN' }, matched_records: '0' }],
    [{ rows: [], totals: { m0: '0' }, matched_records: 0 }],
  ])(
    'rejects invalid SQL result without a fabricated zero %#',
    async (output) => {
      const f = fixture();
      f.state.output = output;
      await expect(f.useCase.execute(identity, f.request())).rejects.toThrow(
        'nodia_ai:report_unavailable',
      );
    },
  );
  it('rejects invalid version, unsafe scope IDs and cross-source requests before transactions', async () => {
    const f = fixture();
    await expect(
      f.useCase.execute(identity, {
        ...f.request(),
        catalog_version: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      field: 'catalog_version',
    });
    await expect(
      f.useCase.execute(
        identity,
        f.request({ scope: { subject_user_id: '9223372036854775808' } }),
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const input = f.request();
    input.sources.push(input.sources[0]);
    await expect(f.useCase.execute(identity, input)).rejects.toMatchObject({
      code: 'unsupported_semantics',
      field: 'combine',
    });
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('rejects detached transaction managers before SQL or authorization', async () => {
    const f = fixture();
    const detached = {
      ...f.manager,
      queryRunner: { isTransactionActive: false },
    } as EntityManager;
    await expect(
      f.useCase.execute(identity, f.request(), detached),
    ).rejects.toMatchObject({ code: 'invalid_input', field: 'transaction' });
    expect(f.query).not.toHaveBeenCalled();
    expect(f.load).not.toHaveBeenCalled();
  });
  it('rejects a stale preexisting snapshot before loading authority or domain records', async () => {
    const f = fixture();
    f.state.isolation = 'repeatable read';
    await expect(
      f.useCase.execute(identity, f.request(), f.manager),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      field: 'transaction_isolation',
    });
    expect(f.load).not.toHaveBeenCalled();
    expect(
      f.query.mock.calls.some(([sql]) => sql.startsWith('WITH filtered')),
    ).toBe(false);
  });
});
