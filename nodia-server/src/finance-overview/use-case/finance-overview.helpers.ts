import { InternalServerErrorException } from '@nestjs/common';
import { validateRansackEnvelope } from '../../common/utils/ransack-query.builder.js';
import type { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import { validateFinanceQuery } from '../../finance-common/finance-query.js';
import type {
  FinanceOverviewScope,
  FinanceSummary,
  FinanceSummaryRow,
} from '../types/finance-overview.types.js';

export function aggregateInteger(value: string): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new InternalServerErrorException('finance:invalid_aggregate_result');
  return BigInt(value);
}

export function aggregateCount(value: string): number {
  const count = aggregateInteger(value);
  if (count > BigInt(Number.MAX_SAFE_INTEGER))
    throw new InternalServerErrorException('finance:invalid_aggregate_result');
  return Number(count);
}

export function overviewScope(query: FinanceQueryDto): FinanceOverviewScope {
  const { s: _sort, ...q } = query.q ?? {};
  return {
    active: query.active ?? 'active',
    movement_filters: {
      q,
      category_ids: [...(query.category_ids ?? [])],
      category_group_ids: [...(query.category_group_ids ?? [])],
      obligation_id: query.obligation_id ?? null,
    },
    obligation_balances: {
      active: query.active ?? 'active',
      repayments: 'all_confirmed_history',
      includes_inactive_repayments: true,
      ignores_movement_filters: true,
    },
  };
}

export function splitSummaryQuery(
  query: FinanceQueryDto,
  grouped: boolean,
): { catalogue: FinanceQueryDto; movements: FinanceQueryDto } {
  validateRansackEnvelope(query.q);
  const catalogQ: Record<string, unknown> = {};
  const movementQ: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query.q ?? {}))
    (['name_cont', 'key_cont', 's'].includes(key) ? catalogQ : movementQ)[key] =
      value;
  const {
    category_ids: _categoryIds,
    category_group_ids: _categoryGroupIds,
    obligation_id: _obligationId,
    ...catalogueBase
  } = query;
  const catalogue = { ...catalogueBase, q: catalogQ };
  const movements = { ...query, q: movementQ };
  validateFinanceQuery(catalogue, grouped ? 'category-groups' : 'categories');
  validateFinanceQuery(movements, 'movements');
  return { catalogue, movements };
}

export function mapSummary(row: FinanceSummaryRow): FinanceSummary {
  const income = aggregateInteger(row.income_amount);
  const expense = aggregateInteger(row.expense_amount);
  return {
    ...row,
    movement_count: aggregateCount(row.movement_count),
    income_amount: income.toString(),
    expense_amount: expense.toString(),
    net_amount: (income - expense).toString(),
  };
}
