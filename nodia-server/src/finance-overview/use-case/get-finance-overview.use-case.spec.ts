import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import {
  applyFinanceMovementFilters,
  applyFinanceQuery,
} from '../../finance-common/finance-query.js';
import type { FinanceOverviewService } from '../finance-overview.service.js';
import { GetFinanceOverviewUseCase } from './get-finance-overview.use-case.js';

function fixture() {
  const manager = {} as EntityManager;
  const service = {
    snapshot: vi.fn((operation: (tx: EntityManager) => Promise<unknown>) =>
      operation(manager),
    ),
    totals: vi
      .fn()
      .mockResolvedValue({
        income_amount: '9007199254740995',
        expense_amount: '9007199254741000',
        movement_count: '25',
        pending_count: '2',
        cancelled_count: '1',
      }),
    counts: vi
      .fn()
      .mockResolvedValue({
        categories: '3',
        category_groups: '2',
        loans: '1',
        debts: '0',
      }),
    obligationBalances: vi
      .fn()
      .mockResolvedValue({
        loan_remaining_amount: '60000',
        debt_remaining_amount: '0',
      }),
  };
  return {
    service,
    manager,
    useCase: new GetFinanceOverviewUseCase(
      service as unknown as FinanceOverviewService,
    ),
  };
}

describe('GetFinanceOverviewUseCase', () => {
  it('calculates exact net beyond Number precision and states historical repayment scope', async () => {
    const { useCase, service, manager } = fixture();
    const query = Object.assign(new FinanceQueryDto(), {
      q: { created_at_gteq: '2026-10-01T00:00:00Z' },
      category_group_ids: ['7', '8'],
    });
    const result = await useCase.execute('12', query);
    expect(result.totals).toEqual({
      income_amount: '9007199254740995',
      expense_amount: '9007199254741000',
      net_amount: '-5',
      movement_count: 25,
      pending_count: 2,
      cancelled_count: 1,
    });
    expect(result.obligations.loan_remaining_amount).toBe('60000');
    expect(result.scope.obligation_balances).toEqual({
      active: 'active',
      repayments: 'all_confirmed_history',
      includes_inactive_repayments: true,
      ignores_movement_filters: true,
    });
    expect(service.totals).toHaveBeenCalledWith('12', query, manager);
    expect(service.counts).toHaveBeenCalledWith('12', query, manager);
    expect(service.obligationBalances).toHaveBeenCalledWith(
      '12',
      query,
      manager,
    );
  });

  it.each([
    { q: { user_id_eq: '99' } },
    { q: { is_active_eq: 'false' } },
    { q: { name_cont: { nested: 'x' } } },
    { q: { amount_gt: '1' } },
    { q: { name_gt: 'foo' } },
    { q: { s: 'name desc; DROP TABLE users' } },
    { q: { created_at_gteq: '2026-02-30T00:00:00Z' } },
    {
      q: {
        created_at_gteq: '2026-10-05T00:00:00Z',
        created_at_lt: '2026-10-04T00:00:00Z',
      },
    },
    { q: { type_eq: 'income', status_eq: 'paid' } },
    { active: 'false' },
    { limit: 101 },
    { page: null },
    { all: true },
    { category_ids: Array.from({ length: 101 }, (_, i) => String(i + 1)) },
    { category_group_ids: ['1', '1'] },
    { obligation_id: '9223372036854775808' },
  ])('rejects malformed filters before any persistence: %j', async (input) => {
    const { useCase, service } = fixture();
    await expect(
      useCase.execute('12', Object.assign(new FinanceQueryDto(), input)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.snapshot).not.toHaveBeenCalled();
  });

  it('propagates aggregate failure without fabricating successful zero indicators', async () => {
    const { useCase, service } = fixture();
    service.obligationBalances.mockRejectedValue(
      new Error('synthetic unavailable'),
    );
    await expect(useCase.execute('12', new FinanceQueryDto())).rejects.toThrow(
      'synthetic unavailable',
    );
  });

  it('rejects invalid repository aggregates rather than coercing them to money', async () => {
    const { useCase, service } = fixture();
    service.totals.mockResolvedValue({
      income_amount: 'NaN',
      expense_amount: '0',
      movement_count: '0',
      pending_count: '0',
      cancelled_count: '0',
    });
    await expect(
      useCase.execute('12', new FinanceQueryDto()),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('retains literal search, owner scope, stable sort and group union without a multiplying join', () => {
    // Exercise the production compiler and PostgreSQL driver without opening a connection.
    const source = new DataSource({ type: 'postgres' });
    const qb = source
      .createQueryBuilder()
      .from('finance_movements', 'movement')
      .where('movement.user_id = :owner', { owner: '12' });
    const query = Object.assign(new FinanceQueryDto(), {
      q: { name_cont: "50%_'; DROP TABLE users; --", s: 'created_at desc' },
      category_ids: ['3'],
      category_group_ids: ['7', '8'],
    });
    applyFinanceQuery(qb, 'movement', query, 'movements');
    applyFinanceMovementFilters(qb, 'movement', query);
    const [sql, params] = qb.getQueryAndParameters();
    expect(sql).toContain('movement.user_id = $1');
    expect(sql).toContain('EXISTS');
    expect(sql).toContain('finance_membership.user_id = movement.user_id');
    expect(sql).not.toContain('JOIN');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain(
      'ORDER BY movement.created_at DESC, movement.id DESC',
    );
    expect(params).toContain("%50!%!_'; DROP TABLE users; --%");
    expect(params).toContain(true);
    expect(params).toContain('7');
    expect(params).toContain('8');
  });

  it('supports inactive/all explicitly and defaults to active when filters reset', () => {
    const source = new DataSource({ type: 'postgres' });
    for (const active of ['active', 'inactive', 'all'] as const) {
      const qb = source
        .createQueryBuilder()
        .from('finance_movements', 'movement');
      applyFinanceQuery(
        qb,
        'movement',
        Object.assign(new FinanceQueryDto(), { active }),
        'movements',
      );
      expect(qb.getParameters().finance_active).toBe(
        active === 'all' ? undefined : active === 'active',
      );
    }
    const reset = source
      .createQueryBuilder()
      .from('finance_movements', 'movement');
    applyFinanceQuery(reset, 'movement', new FinanceQueryDto(), 'movements');
    expect(reset.getParameters().finance_active).toBe(true);
  });
});
