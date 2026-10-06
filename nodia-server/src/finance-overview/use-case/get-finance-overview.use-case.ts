import { Injectable } from '@nestjs/common';
import type { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import { validateFinanceQuery } from '../../finance-common/finance-query.js';
import { FinanceOverviewService } from '../finance-overview.service.js';
import type { FinanceOverview } from '../types/finance-overview.types.js';
import {
  aggregateCount,
  aggregateInteger,
  overviewScope,
} from './finance-overview.helpers.js';

@Injectable()
export class GetFinanceOverviewUseCase {
  constructor(private readonly service: FinanceOverviewService) {}

  async execute(
    userId: string,
    query: FinanceQueryDto,
  ): Promise<FinanceOverview> {
    validateFinanceQuery(query, 'movements');
    // A transactional manager owns one PostgreSQL client; queries run sequentially.
    const { totals, counts, obligations } = await this.service.snapshot(
      async (manager) => {
        const totals = await this.service.totals(userId, query, manager);
        const counts = await this.service.counts(userId, query, manager);
        const obligations = await this.service.obligationBalances(
          userId,
          query,
          manager,
        );
        return { totals, counts, obligations };
      },
    );
    const income = aggregateInteger(totals.income_amount);
    const expense = aggregateInteger(totals.expense_amount);
    return {
      scope: overviewScope(query),
      totals: {
        income_amount: income.toString(),
        expense_amount: expense.toString(),
        net_amount: (income - expense).toString(),
        movement_count: aggregateCount(totals.movement_count),
        pending_count: aggregateCount(totals.pending_count),
        cancelled_count: aggregateCount(totals.cancelled_count),
      },
      counts: {
        categories: aggregateCount(counts.categories),
        category_groups: aggregateCount(counts.category_groups),
        loans: aggregateCount(counts.loans),
        debts: aggregateCount(counts.debts),
      },
      obligations: {
        loan_remaining_amount: aggregateInteger(
          obligations.loan_remaining_amount,
        ).toString(),
        debt_remaining_amount: aggregateInteger(
          obligations.debt_remaining_amount,
        ).toString(),
      },
    };
  }
}
