import { describe, expect, it, vi } from 'vitest';
import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ComposeNodiaAiReportUseCase } from './compose-nodia-ai-report.use-case.js';
import { CompileNodiaAiReportUseCase } from './compile-nodia-ai-report.use-case.js';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import type { RunNodiaAiReportUseCase } from './run-nodia-ai-report.use-case.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { NodiaAiReportQuery } from '../types/report-composition.types.js';
import type { NodiaAiSourceReportResult } from '../types/report-result.types.js';

const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
  policyEnvelope(),
);
const registry = new NodiaAiReportRegistryUseCase(policy);
const compiler = new CompileNodiaAiReportUseCase();
const identity = {
  userId: '1',
  sessionId: '11111111-1111-4111-8111-111111111111',
};
function query(): NodiaAiReportQuery {
  return {
    catalog_version: registry.catalogVersion,
    combine: 'separate',
    sources: ['first', 'second'].map((alias) => ({
      source_key: 'finance_movements',
      alias,
      scope: {},
      measures: [
        {
          measure_key: 'confirmed_amount',
          aggregation: 'sum',
          output_key: 'total',
        },
      ],
    })),
  };
}
function fixture() {
  const state = {
    outputs: new Map<
      string,
      {
        rows?: NodiaAiSourceReportResult['rows'];
        total?: string;
        matched?: string;
        next?: string | null;
      }
    >(),
    failures: new Map<string, Error>(),
    globalError: null as Error | null,
    lateDenied: false,
  };
  const authorize = {
    execute: vi.fn(async () => {
      if (state.globalError) throw state.globalError;
      return { actorId: '1', sessionId: identity.sessionId };
    }),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async () => []),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: vi.fn(
      async (
        _isolation: string,
        work: (manager: EntityManager) => Promise<unknown>,
      ) => work(manager),
    ),
  } as unknown as DataSource;
  const run = {
    execute: vi.fn(
      async (
        _identity: unknown,
        input: NodiaAiReportQuery,
      ): Promise<NodiaAiSourceReportResult> => {
        const request = input.sources[0];
        if (state.failures.has(request.alias))
          throw state.failures.get(request.alias)!;
        const custom = state.outputs.get(request.alias) ?? {};
        const compiled = compiler.execute({
          request,
          source: registry.get(request.source_key),
          catalogVersion: registry.catalogVersion,
          scopeSql: 'TRUE',
          scopeParameters: [],
          scopeFingerprint: 'fixture',
          sourceTimezone: request.period?.timezone,
          limits: {
            maxGroups: 100,
            maxFilters: 20,
            maxCollectionItems: 128,
            defaultGroups: 25,
          },
        });
        const columns = compiled.columns.map((column) => ({
          key: column.output_key,
          label_key: `nodia_ai.reports.${column.output_key}`,
          value_type: column.value_type,
          unit: column.unit,
          scale: column.scale,
          source_aliases: [request.alias],
        }));
        return {
          status: custom.matched === '0' ? 'empty' : 'ok',
          report_id: randomUUID(),
          catalog_version: registry.catalogVersion,
          source_key: request.source_key,
          source_alias: request.alias,
          scope: request.scope,
          columns,
          rows: custom.rows ?? [['18014398509481986']],
          totals: Object.fromEntries(
            request.measures.map((measure) => [
              measure.output_key,
              custom.total ?? '18014398509481986',
            ]),
          ),
          matched_records: custom.matched ?? '2',
          period: request.period ?? null,
          basis_key:
            request.period?.dimension_key ??
            registry.get(request.source_key).descriptor.basis_key,
          observed_at: '2026-10-17T20:00:00Z',
          group_page_complete: !custom.next,
          next_cursor: custom.next ?? null,
        };
      },
    ),
    verifyAuthority: vi.fn(async () => {
      if (state.lateDenied)
        throw new ForbiddenException('nodia_ai:capability_denied');
    }),
  };
  const useCase = new ComposeNodiaAiReportUseCase(
    dataSource,
    registry,
    compiler,
    run as unknown as RunNodiaAiReportUseCase,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    policy,
  );
  return { state, run, useCase, authorize, dataSource };
}

describe('ComposeNodiaAiReportUseCase', () => {
  it('keeps exact totals separately, independent snapshots and sparse rows without a grand total', async () => {
    const { useCase } = fixture();
    const result = await useCase.execute(identity, query());
    expect(result.source_results.map((source) => source.totals.total)).toEqual([
      '18014398509481986',
      '18014398509481986',
    ]);
    expect(result.rows).toEqual([
      ['first', '18014398509481986', null],
      ['second', null, '18014398509481986'],
    ]);
    expect(result.provenance.map((source) => source.source_alias)).toEqual([
      'first',
      'second',
    ]);
    expect(result.snapshot_consistency).toBe('independent_source_snapshots');
    expect(Object.hasOwn(result, 'total')).toBe(false);
  });
  it('aligns compatible bounded groups by typed keys and leaves unavailable groups null', async () => {
    const { useCase, state } = fixture();
    const input = query();
    input.combine = 'compare_compatible';
    input.sources.forEach((source) => {
      source.group_by = [{ dimension_key: 'status', output_key: 'state' }];
    });
    state.outputs.set('first', {
      rows: [
        ['paid', '10'],
        ['pending', '0'],
      ],
      total: '10',
    });
    state.outputs.set('second', { rows: [['paid', '20']], total: '20' });
    const result = await useCase.execute(identity, input);
    expect(result.rows).toEqual([
      ['paid', '10', '20'],
      ['pending', '0', null],
    ]);
  });
  it('refuses grouped comparison with independent incomplete pages', async () => {
    const { useCase, state } = fixture();
    const input = query();
    input.combine = 'compare_compatible';
    input.sources.forEach((source) => {
      source.group_by = [{ dimension_key: 'status', output_key: 'state' }];
    });
    state.outputs.set('first', { rows: [['paid', '10']], next: 'cursor' });
    await expect(useCase.execute(identity, input)).rejects.toMatchObject({
      code: 'unsupported_semantics',
      field: 'combine.pagination',
    });
  });
  it.each(['unit', 'semantic', 'period', 'groups'] as const)(
    'rejects incompatible %s before execution',
    async (kind) => {
      const { useCase, run } = fixture();
      const input = query();
      input.combine = 'compare_compatible';
      if (kind === 'unit')
        input.sources[1] = {
          source_key: 'rental_expenses',
          alias: 'second',
          scope: { property_id: '1' },
          measures: [
            { measure_key: 'amount', aggregation: 'sum', output_key: 'total' },
          ],
        };
      if (kind === 'semantic')
        input.sources[1].measures[0].measure_key = 'confirmed_expense_amount';
      if (kind === 'period')
        input.sources[1].period = {
          kind: 'instant',
          dimension_key: 'created_at',
          from: '2026-01-01T00:00:00Z',
          to_exclusive: '2026-02-01T00:00:00Z',
          timezone: 'America/Santiago',
        };
      if (kind === 'groups')
        input.sources[1].group_by = [
          { dimension_key: 'status', output_key: 'status' },
        ];
      await expect(useCase.execute(identity, input)).rejects.toMatchObject({
        code: 'unsupported_semantics',
      });
      expect(run.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['duplicate', 'unknownfield', 'pagebudget', 'catalog'] as const)(
    'rejects invalid %s before report work',
    async (kind) => {
      const { useCase, run } = fixture();
      const input = query();
      if (kind === 'duplicate') input.sources[1].alias = 'first';
      if (kind === 'unknownfield')
        input.sources[1].filters = {
          all: [{ field_key: 'secret', operator: 'eq', value: 'x' }],
        };
      if (kind === 'pagebudget') input.page_limit = 1;
      if (kind === 'catalog') input.catalog_version = 'a'.repeat(64);
      await expect(useCase.execute(identity, input)).rejects.toBeDefined();
      expect(run.execute).not.toHaveBeenCalled();
    },
  );
  it.each(['overflow', 'fanout', 'filters'] as const)(
    'bounds %s before any source SQL',
    async (kind) => {
      const { useCase, run } = fixture();
      const input = query();
      if (kind === 'overflow')
        input.sources[1].scope.subject_user_id = '9223372036854775808';
      if (kind === 'fanout')
        input.sources = Array.from({ length: 13 }, (_, index) => ({
          ...input.sources[0],
          alias: `source${index}`,
        }));
      if (kind === 'filters')
        input.sources.forEach((source) => {
          source.filters = {
            all: Array.from({ length: 11 }, () => ({
              field_key: 'status',
              operator: 'eq' as const,
              value: 'paid',
            })),
          };
        });
      await expect(useCase.execute(identity, input)).rejects.toBeDefined();
      expect(run.execute).not.toHaveBeenCalled();
    },
  );
  it('rejects ambiguous composite column keys before any source SQL', async () => {
    const { useCase, run } = fixture();
    const input = query();
    input.sources[0].alias = 'a.b';
    input.sources[0].measures[0].output_key = 'c';
    input.sources[1].alias = 'a';
    input.sources[1].measures[0].output_key = 'b.c';
    await expect(useCase.execute(identity, input)).rejects.toMatchObject({
      code: 'invalid_input',
      field: 'output_key',
    });
    expect(run.execute).not.toHaveBeenCalled();
  });
  it('keeps destination failure unknown with successful exact zero and safe errors', async () => {
    const { useCase, state } = fixture();
    state.failures.set(
      'first',
      new ServiceUnavailableException('SQL password secret'),
    );
    state.outputs.set('second', { rows: [['0']], total: '0', matched: '0' });
    const result = await useCase.execute(identity, query());
    expect(result.status).toBe('partial');
    expect(result.source_results).toHaveLength(1);
    expect(result.source_results[0].totals.total).toBe('0');
    expect(JSON.stringify(result)).not.toContain('password');
    expect(result.source_errors[0].error.code).toBe('report_unavailable');
  });
  it('preserves failed source metadata across continuation pages and binds actor and query', async () => {
    const { useCase, state, run } = fixture();
    const input = query();
    state.failures.set('first', new ForbiddenException());
    state.outputs.set('second', { next: 'internal-source-cursor' });
    const first = await useCase.execute(identity, input);
    expect(first.status).toBe('partial');
    state.outputs.set('second', { next: null });
    const next = await useCase.execute(identity, {
      ...input,
      cursor: first.next_cursor!,
    });
    expect(next.status).toBe('partial');
    expect(next.source_errors).toEqual(first.source_errors);
    expect(next.source_results.map((source) => source.source_alias)).toEqual([
      'second',
    ]);
    expect(run.execute).toHaveBeenCalledTimes(3);
    await expect(
      useCase.execute(
        { ...identity, userId: '2' },
        { ...input, cursor: first.next_cursor! },
      ),
    ).rejects.toMatchObject({ field: 'cursor' });
    const changed = structuredClone(input);
    changed.sources[1].measures[0].measure_key = 'confirmed_expense_amount';
    await expect(
      useCase.execute(identity, { ...changed, cursor: first.next_cursor! }),
    ).rejects.toMatchObject({ field: 'cursor' });
  });
  it('does not turn session or NodiaAI denial into partial', async () => {
    const { useCase, state, run } = fixture();
    state.globalError = new UnauthorizedException();
    await expect(useCase.execute(identity, query())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(run.execute).not.toHaveBeenCalled();
    state.globalError = new ForbiddenException();
    await expect(useCase.execute(identity, query())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('checks cancellation before work and after each source without detached work', async () => {
    const { useCase, run } = fixture();
    const controller = new AbortController();
    controller.abort();
    await expect(
      useCase.execute(identity, query(), { signal: controller.signal }),
    ).rejects.toThrow('nodia_ai:report_cancelled');
    expect(run.execute).not.toHaveBeenCalled();
    await expect(
      useCase.execute(identity, query(), { deadlineAt: Date.now() - 1 }),
    ).rejects.toThrow('nodia_ai:report_cancelled');
  });
  it('rejects a destination revoked after its snapshot before returning data', async () => {
    const { useCase, state } = fixture();
    state.lateDenied = true;
    await expect(useCase.execute(identity, query())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('reauthorizes stored scopes without running a report', async () => {
    const { useCase, run } = fixture();
    await useCase.verifyAuthority(identity, query());
    expect(run.execute).not.toHaveBeenCalled();
    expect(run.verifyAuthority).toHaveBeenCalledTimes(2);
  });
  it.each([
    'totalnumber',
    'unit',
    'nullsum',
    'rowwidth',
    'provenance',
    'status',
    'scope',
    'period',
    'extra',
    'cycle',
    'getter',
  ] as const)('rejects corrupt %s output', async (kind) => {
    const { useCase } = fixture();
    const input = query();
    const result = await useCase.execute(identity, input);
    const bad = structuredClone(result);
    if (kind === 'totalnumber')
      (
        bad.source_results[0].totals as unknown as Record<string, unknown>
      ).total = 42;
    if (kind === 'unit') {
      bad.source_results[0].columns[0].unit = 'CLP';
      bad.columns[1].unit = 'CLP';
    }
    if (kind === 'nullsum') {
      bad.source_results[0].rows[0][0] = null;
      bad.rows[0][1] = null;
    }
    if (kind === 'rowwidth') bad.rows[0].push('extra');
    if (kind === 'provenance') bad.provenance[0].matched_records = '0';
    if (kind === 'status') bad.status = 'empty';
    if (kind === 'scope') {
      bad.source_results[0].scope = { property_id: '7' };
      bad.provenance[0].scope = { property_id: '7' };
    }
    if (kind === 'period') {
      bad.source_results[0].basis_key = 'paid_on';
      bad.provenance[0].basis_key = 'paid_on';
    }
    if (kind === 'extra') Object.assign(bad, { secret: 'wrong' });
    if (kind === 'cycle') Object.assign(bad, { cycle: bad });
    if (kind === 'getter')
      Object.defineProperty(bad, 'danger', {
        get() {
          throw Error('Getter invoked');
        },
        enumerable: true,
      });
    expect(() => useCase.validateResult(bad, input)).toThrow();
  });
});
