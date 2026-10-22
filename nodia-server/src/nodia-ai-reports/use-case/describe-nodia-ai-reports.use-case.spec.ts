import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { DescribeNodiaAiReportsUseCase } from './describe-nodia-ai-reports.use-case.js';
import { NodiaAiReportRegistryUseCase } from './nodia-ai-report-registry.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiAuthorizationService } from '../../nodia-ai/nodia-ai-authorization.service.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';

const identity = {
  userId: '1',
  sessionId: '11111111-1111-4111-8111-111111111111',
};
const registry = new NodiaAiReportRegistryUseCase(
  new ValidateNodiaAiRuntimePolicyUseCase().execute(policyEnvelope()),
);
function fixture() {
  const modules = [
    { id: '1', key: 'nodia_ai', route: '/tools/nodia-ai', assigned: true },
    {
      id: '2',
      key: 'personal_finance',
      route: '/tools/finances-personal',
      assigned: true,
    },
    { id: '3', key: 'businesses', route: '/tools/business', assigned: false },
    {
      id: '4',
      key: 'rental_reservations',
      route: '/tools/reservations',
      assigned: false,
    },
  ];
  const snapshot = {
    actorId: identity.userId,
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules,
    actionKeys: [],
  };
  const state = { isolation: 'read committed' };
  const query = vi.fn(async (sql: string) =>
    sql === 'SHOW transaction_isolation'
      ? [{ transaction_isolation: state.isolation }]
      : [],
  );
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const load = vi.fn(async () => snapshot);
  const authorize = new AuthorizeNodiaAiUseCase({
    loadCurrentActor: load,
  } as unknown as NodiaAiAuthorizationService);
  const transaction = vi.fn(
    async (
      _level: string,
      work: (manager: EntityManager) => Promise<unknown>,
    ) => work(manager),
  );
  const useCase = new DescribeNodiaAiReportsUseCase(
    { transaction } as unknown as DataSource,
    registry,
    authorize,
  );
  return { useCase, snapshot, query, manager, load, transaction, state };
}

describe('DescribeNodiaAiReportsUseCase', () => {
  it('exposes only current module assignments under authority lock and no physical SQL mapping', async () => {
    const f = fixture();
    const result = await f.useCase.execute(identity);
    expect(result.sources.map((source) => source.source_key)).toEqual([
      'finance_movements',
      'finance_obligations',
    ]);
    expect(result.next_cursor).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(
      /expressionSql|fromSql|correlationSql|finance_category_group_memberships/,
    );
    expect(f.query.mock.calls).toHaveLength(4);
    expect(f.load.mock.invocationCallOrder[0]).toBeGreaterThan(
      f.query.mock.invocationCallOrder[3],
    );
    expect(f.transaction.mock.calls[0][0]).toBe('READ COMMITTED');
  });
  it('rechecks revocation every time and requires NodiaAI even if a destination is assigned', async () => {
    const f = fixture();
    await f.useCase.execute(identity);
    f.snapshot.modules[1].assigned = false;
    expect((await f.useCase.execute(identity)).sources).toEqual([]);
    f.snapshot.modules[0].assigned = false;
    await expect(f.useCase.execute(identity)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
    expect(f.load).toHaveBeenCalledTimes(3);
  });
  it('filters requested modules without treating the request as a permission grant', async () => {
    const f = fixture();
    expect(
      (await f.useCase.execute(identity, { module_keys: ['businesses'] }))
        .sources,
    ).toEqual([]);
    f.snapshot.isSuperAdmin = true;
    const result = await f.useCase.execute(identity, {
      module_keys: ['businesses'],
    });
    expect(result.sources).toHaveLength(4);
    expect(
      result.sources.every((source) => source.module_key === 'businesses'),
    ).toBe(true);
  });
  it('returns detached descriptors without permitting caller mutation of the registry', async () => {
    const f = fixture();
    const result = await f.useCase.execute(identity);
    (result.sources[0] as unknown as { field_keys: string[] }).field_keys = [
      'injected',
    ];
    expect(
      (await f.useCase.execute(identity)).sources[0].field_keys,
    ).not.toContain('injected');
  });
  it('rejects unsupported cursor and detached transactions before any authority SQL', async () => {
    const f = fixture();
    await expect(
      f.useCase.execute(identity, { cursor: 'unbound' }),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const detached = {
      ...f.manager,
      queryRunner: { isTransactionActive: false },
    } as EntityManager;
    await expect(f.useCase.execute(identity, {}, detached)).rejects.toThrow(
      'nodia_ai:invalid_input',
    );
    expect(f.query).not.toHaveBeenCalled();
    expect(f.load).not.toHaveBeenCalled();
  });
  it('rejects a preexisting repeatable-read snapshot before loading authority', async () => {
    const f = fixture();
    f.state.isolation = 'repeatable read';
    await expect(
      f.useCase.execute(identity, {}, f.manager),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      field: 'transaction_isolation',
    });
    expect(f.load).not.toHaveBeenCalled();
  });
});
