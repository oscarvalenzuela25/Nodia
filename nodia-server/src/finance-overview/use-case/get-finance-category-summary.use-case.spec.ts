import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import type { FinanceOverviewService } from '../finance-overview.service.js';
import { GetFinanceCategorySummaryUseCase } from './get-finance-category-summary.use-case.js';

function fixture() {
  const manager = {} as EntityManager;
  const service = {
    snapshot: vi.fn((operation: (tx: EntityManager) => Promise<unknown>) =>
      operation(manager),
    ),
    summary: vi
      .fn()
      .mockResolvedValue({
        rows: [
          {
            id: '3',
            name: 'Sin actividad',
            key: 'empty',
            is_active: true,
            movement_count: '0',
            income_amount: '0',
            expense_amount: '0',
          },
        ],
        total: 25,
      }),
  };
  return {
    service,
    manager,
    useCase: new GetFinanceCategorySummaryUseCase(
      service as unknown as FinanceOverviewService,
    ),
  };
}

describe('GetFinanceCategorySummaryUseCase', () => {
  it('keeps real zero categories and separates catalogue search from financial filters', async () => {
    const { useCase, service, manager } = fixture();
    const query = Object.assign(new FinanceQueryDto(), {
      page: 2,
      q: {
        name_cont: 'Sin',
        key_cont: 'emp',
        type_eq: 'income',
        created_at_lt: '2026-10-05T00:00:00Z',
      },
      category_group_ids: ['7'],
    });
    const result = await useCase.execute('12', query);
    expect(result.data[0]).toMatchObject({
      id: '3',
      movement_count: 0,
      income_amount: '0',
      expense_amount: '0',
      net_amount: '0',
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total_items: 25,
      total_pages: 3,
    });
    expect(service.summary).toHaveBeenCalledWith(
      '12',
      expect.objectContaining({ q: { name_cont: 'Sin', key_cont: 'emp' } }),
      expect.objectContaining({
        q: { type_eq: 'income', created_at_lt: '2026-10-05T00:00:00Z' },
        category_group_ids: ['7'],
      }),
      false,
      manager,
    );
    expect(result.scope.movement_filters.q).not.toHaveProperty('name_cont');
  });

  it('rejects unknown root/envelope fields even when summary extracts catalogue predicates', async () => {
    const { useCase, service } = fixture();
    await expect(
      useCase.execute(
        '12',
        Object.assign(new FinanceQueryDto(), {
          q: { name_cont: 'ok', user_id_eq: '99' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute(
        '12',
        Object.assign(new FinanceQueryDto(), {
          all: true,
          q: { key_cont: 'ok' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.snapshot).not.toHaveBeenCalled();
  });

  it('returns a documented empty page, preserving total metadata', async () => {
    const { useCase, service } = fixture();
    service.summary.mockResolvedValue({ rows: [], total: 0 });
    const result = await useCase.execute('99', new FinanceQueryDto());
    expect(result.data).toEqual([]);
    expect(result.meta.total_pages).toBe(0);
  });
});
