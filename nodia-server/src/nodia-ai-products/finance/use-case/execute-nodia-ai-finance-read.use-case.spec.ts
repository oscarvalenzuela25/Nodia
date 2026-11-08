import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { FinanceCategoryService } from '../../../finance-category/finance-category.service.js';
import { GetFinanceCategoryUseCase } from '../../../finance-category/use-case/get-finance-category.use-case.js';
import { GetFinanceCategoriesUseCase } from '../../../finance-category/use-case/get-finance-categories.use-case.js';
import { FinanceOverviewService } from '../../../finance-overview/finance-overview.service.js';
import { GetFinanceOverviewUseCase } from '../../../finance-overview/use-case/get-finance-overview.use-case.js';
import { NodiaAiToolRegistryUseCase } from '../../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { createNodiaAiFinanceReadFamily } from '../finance-read.family.js';
import {
  ExecuteNodiaAiFinanceReadUseCase,
  type NodiaAiFinanceReadPorts,
} from './execute-nodia-ai-finance-read.use-case.js';

function valid(
  registry: NodiaAiToolRegistryUseCase,
  side: 'input' | 'output',
  name: string,
  value: unknown,
): boolean {
  try {
    const tool = registry.get(name);
    if (!tool) return false;
    if (side === 'input') registry.validateInput(tool, value);
    else registry.validateOutput(tool, value);
    return true;
  } catch {
    return false;
  }
}

function fixture() {
  let superAdmin = false;
  let isolation = 'repeatable read';
  let validSession = true;
  const query = vi.fn(async (sql: string) => {
    if (sql === 'SHOW transaction_isolation')
      return [{ transaction_isolation: isolation }];
    if (sql.startsWith('SELECT u.id'))
      return validSession
        ? [
            {
              actorId: '1',
              sessionId: '11111111-1111-4111-8111-111111111111',
              isSuperAdmin: superAdmin,
            },
          ]
        : [];
    if (sql.startsWith('SELECT EXISTS')) return [{ exists: true }];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const source = {
    transaction: vi.fn(() => {
      throw new Error('independent transaction forbidden');
    }),
  } as unknown as DataSource;
  const scope = new FinanceCategoryService(source);
  const date = new Date('2026-10-16T12:00:00Z');
  vi.spyOn(scope, 'findOwned').mockImplementation(
    async (owner, id, received) => {
      expect(received).toBe(manager);
      return owner === '1' && id === '5'
        ? ({
            id,
            user_id: owner,
            name: 'Food',
            key: 'food',
            is_active: true,
            created_at: date,
            updated_at: date,
          } as Awaited<ReturnType<typeof scope.findOwned>>)
        : null;
    },
  );
  const overviewService = new FinanceOverviewService(source);
  vi.spyOn(overviewService, 'totals').mockResolvedValue({
    income_amount: '18446744073709551614',
    expense_amount: '2',
    movement_count: '3',
    pending_count: '0',
    cancelled_count: '0',
  });
  vi.spyOn(overviewService, 'counts').mockResolvedValue({
    categories: '1',
    category_groups: '1',
    loans: '0',
    debts: '0',
  });
  vi.spyOn(overviewService, 'obligationBalances').mockResolvedValue({
    loan_remaining_amount: '0',
    debt_remaining_amount: '0',
  });
  const unavailable = {
    execute: vi.fn(async () => {
      throw new Error('unused port');
    }),
  };
  const ports = {
    scope,
    category: new GetFinanceCategoryUseCase(scope),
    categories: new GetFinanceCategoriesUseCase(scope),
    group: unavailable,
    groups: unavailable,
    movement: unavailable,
    movements: unavailable,
    obligation: unavailable,
    obligations: unavailable,
    overview: new GetFinanceOverviewUseCase(overviewService),
    byCategory: unavailable,
    byGroup: unavailable,
  } as NodiaAiFinanceReadPorts;
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/finances-personal'],
  };
  const family = createNodiaAiFinanceReadFamily(ports);
  const registry = new NodiaAiToolRegistryUseCase([family], 'test-v1');
  return {
    family,
    registry,
    context,
    source,
    scope,
    overviewService,
    reader: new ExecuteNodiaAiFinanceReadUseCase(ports),
    admin: () => {
      superAdmin = true;
    },
    revoke: () => {
      validSession = false;
    },
    weak: () => {
      isolation = 'read committed';
    },
  };
}

describe('ExecuteNodiaAiFinanceReadUseCase', () => {
  it('preserves the internal three-second SQL ceiling through native Finance scope without acquiring a snapshot before LOCK', async () => {
    const f = fixture();
    const context = { ...f.context, statementTimeoutMs: 3000 };
    await f.reader.verifyAuthority({ id: '5' }, context);
    await f.reader.execute('category', { id: '5' }, context);
    const statements = vi
      .mocked(f.context.manager.query)
      .mock.calls.map(([sql]) => String(sql));
    expect(
      statements.filter((sql) => sql.startsWith('SET LOCAL statement_timeout')),
    ).toEqual([
      "SET LOCAL statement_timeout = '3000ms'",
      "SET LOCAL statement_timeout = '3000ms'",
    ]);
    expect(
      statements.findIndex((sql) => sql.startsWith('SELECT')),
    ).toBeGreaterThan(
      statements.findIndex((sql) => sql.startsWith('LOCK TABLE')),
    );
    expect(
      statements
        .slice(
          0,
          statements.findIndex((sql) => sql.startsWith('LOCK TABLE')),
        )
        .every(
          (sql) =>
            sql.startsWith('SET LOCAL') || sql === 'SHOW transaction_isolation',
        ),
    ).toBe(true);
  });
  it('exports exactly the eleven catalog reads with closed schemas', () => {
    const { family, registry } = fixture();
    expect(family.capabilities).toHaveLength(11);
    expect(registry.list(['/finances-personal'])).toHaveLength(11);
    for (const registration of family.capabilities) {
      expect(registration.capabilityId).toBe(registration.toolName);
      expect(
        valid(registry, 'input', registration.toolName, { sql: 'SELECT *' }),
      ).toBe(false);
      expect(
        valid(registry, 'output', registration.toolName, {
          secret: 'forbidden',
        }),
      ).toBe(false);
    }
  });

  it('uses native owner projections and the checkpoint manager without another transaction', async () => {
    const f = fixture();
    await f.reader.verifyAuthority({ id: '5' }, f.context);
    const result = await f.reader.execute('category', { id: '5' }, f.context);
    expect(result).toEqual({
      id: '5',
      user_id: '1',
      name: 'Food',
      key: 'food',
      is_active: true,
      created_at: '2026-10-16T12:00:00.000Z',
      updated_at: '2026-10-16T12:00:00.000Z',
    });
    expect(
      valid(f.registry, 'output', 'nodia_finance_categories_get', result),
    ).toBe(true);
    expect(f.source.transaction).not.toHaveBeenCalled();
  });

  it('rejects foreign owner before a domain lookup and rechecks session on replay', async () => {
    const f = fixture();
    await expect(
      f.reader.verifyAuthority({ owner_id: '2' }, f.context),
    ).rejects.toThrow('finance:scope_denied');
    expect(f.scope.findOwned).not.toHaveBeenCalled();
    await f.reader.verifyAuthority({}, f.context);
    f.revoke();
    await expect(f.reader.verifyAuthority({}, f.context)).rejects.toThrow(
      'auth:session_expired',
    );
  });

  it('allows explicit super_admin recipient through native authority without impersonating actor', async () => {
    const f = fixture();
    f.admin();
    await expect(
      f.reader.verifyAuthority({ owner_id: '2' }, f.context),
    ).resolves.toBeUndefined();
    await expect(
      f.reader.execute('category', { id: '5', owner_id: '2' }, f.context),
    ).rejects.toThrow('finance:category_not_found');
    expect(f.scope.findOwned).toHaveBeenCalledWith('2', '5', f.context.manager);
  });

  it('preserves native missing/foreign record semantics', async () => {
    const f = fixture();
    await expect(
      f.reader.execute('category', { id: '9' }, f.context),
    ).rejects.toThrow('finance:category_not_found');
  });

  it('requires an active REPEATABLE READ checkpoint before any domain query', async () => {
    const f = fixture();
    f.weak();
    await expect(
      f.reader.execute('category', { id: '5' }, f.context),
    ).rejects.toThrow('authorization:transaction_isolation');
    expect(f.scope.findOwned).not.toHaveBeenCalled();
    const inactive = {
      ...f.context,
      manager: { queryRunner: { isTransactionActive: false } } as EntityManager,
    };
    await expect(f.reader.verifyAuthority({}, inactive)).rejects.toThrow(
      'authorization:transaction_required',
    );
  });

  it('does not round large sums or confuse actual zero with absence', async () => {
    const f = fixture();
    const result = await f.reader.execute('overview', {}, f.context);
    expect(result.totals).toMatchObject({
      income_amount: '18446744073709551614',
      expense_amount: '2',
      net_amount: '18446744073709551612',
      pending_count: 0,
    });
    expect(result.scope).toMatchObject({
      active: 'active',
      obligation_balances: {
        repayments: 'all_confirmed_history',
        ignores_movement_filters: true,
      },
    });
    expect(
      valid(f.registry, 'output', 'nodia_finance_summaries_overview', result),
    ).toBe(true);
  });

  it('propagates aggregate failure instead of fabricating zero totals', async () => {
    const f = fixture();
    vi.mocked(f.overviewService.totals).mockRejectedValue(
      new Error('database unavailable'),
    );
    await expect(f.reader.execute('overview', {}, f.context)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('rejects out-of-range bigint identifiers before SQL without Number conversion', async () => {
    const f = fixture();
    await expect(
      f.reader.execute('category', { id: '9223372036854775808' }, f.context),
    ).rejects.toThrow('finance:invalid_positive_integer');
    expect(f.scope.findOwned).not.toHaveBeenCalled();
  });

  it('bounds filters, activity and sort fields without arbitrary SQL identifiers', () => {
    const { registry } = fixture();
    expect(
      valid(registry, 'input', 'nodia_finance_movements_list', {
        active: 'all',
        q: { status_eq: 'paid', s: 'created_at desc' },
        category_ids: ['5'],
      }),
    ).toBe(true);
    for (const input of [
      { all: true },
      { limit: 101 },
      { q: { user_id_eq: '2' } },
      { q: { s: 'password asc' } },
      { category_ids: ['5', '5'] },
      { active: null },
    ])
      expect(
        valid(registry, 'input', 'nodia_finance_movements_list', input),
      ).toBe(false);
    expect(
      valid(registry, 'input', 'nodia_finance_categories_list', {
        category_ids: ['5'],
      }),
    ).toBe(false);
    expect(
      valid(registry, 'input', 'nodia_finance_obligations_list', {
        q: { type_eq: 'loan' },
      }),
    ).toBe(true);
  });

  it('rejects a cached result carrying another owner or another detail identifier', async () => {
    const f = fixture();
    await expect(
      f.reader.verifyResultAuthority(
        {},
        { data: [{ user_id: '2' }] },
        f.context,
      ),
    ).rejects.toThrow('finance:scope_denied');
    await expect(
      f.reader.verifyResultAuthority(
        { id: '5' },
        { id: '6', user_id: '1' },
        f.context,
      ),
    ).rejects.toThrow('finance:scope_denied');
    await expect(
      f.reader.verifyResultAuthority(
        { id: '5' },
        { id: '5', user_id: '1' },
        f.context,
      ),
    ).resolves.toBeUndefined();
  });
});
