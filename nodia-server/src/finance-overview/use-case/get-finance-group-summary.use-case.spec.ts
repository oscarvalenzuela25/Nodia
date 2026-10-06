import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import type { FinanceOverviewService } from '../finance-overview.service.js';
import { GetFinanceGroupSummaryUseCase } from './get-finance-group-summary.use-case.js';

describe('GetFinanceGroupSummaryUseCase', () => {
  it('retains overlapping group amounts and explicitly prevents additive interpretation', async () => {
    const manager = {} as EntityManager;
    const service = {
      snapshot: vi.fn((operation: (tx: EntityManager) => Promise<unknown>) =>
        operation(manager),
      ),
      summary: vi.fn().mockResolvedValue({
        rows: [
          {
            id: '7',
            name: 'Hogar',
            key: 'home',
            is_active: true,
            movement_count: '2',
            income_amount: '0',
            expense_amount: '40000',
          },
          {
            id: '8',
            name: 'Mensual',
            key: 'monthly',
            is_active: true,
            movement_count: '2',
            income_amount: '0',
            expense_amount: '40000',
          },
        ],
        total: 2,
      }),
    };
    const useCase = new GetFinanceGroupSummaryUseCase(
      service as unknown as FinanceOverviewService,
    );
    const result = await useCase.execute('12', new FinanceQueryDto());
    expect(result.overlapping_groups).toBe(true);
    expect(result.data.map((row) => row.net_amount)).toEqual([
      '-40000',
      '-40000',
    ]);
    expect(service.summary).toHaveBeenCalledWith(
      '12',
      expect.any(Object),
      expect.any(Object),
      true,
      manager,
    );
  });

  it('does not hide failed group queries behind an empty result', async () => {
    const service = {
      snapshot: (operation: (tx: EntityManager) => Promise<unknown>) =>
        operation({} as EntityManager),
      summary: vi.fn().mockRejectedValue(new Error('synthetic failure')),
    };
    await expect(
      new GetFinanceGroupSummaryUseCase(
        service as unknown as FinanceOverviewService,
      ).execute('12', new FinanceQueryDto()),
    ).rejects.toThrow('synthetic failure');
  });
});
