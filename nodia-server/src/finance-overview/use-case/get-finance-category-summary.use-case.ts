import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import type { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import { financePage } from '../../finance-common/finance-query.js';
import { FinanceOverviewService } from '../finance-overview.service.js';
import type { FinanceSummaryPage } from '../types/finance-overview.types.js';
import {
  mapSummary,
  overviewScope,
  splitSummaryQuery,
} from './finance-overview.helpers.js';

@Injectable()
export class GetFinanceCategorySummaryUseCase {
  constructor(private readonly service: FinanceOverviewService) {}

  async execute(
    actor: FinanceActor,
    query: FinanceQueryDto,
  ): Promise<FinanceSummaryPage> {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        const { catalogue, movements } = splitSummaryQuery(query, false);
        const result = await this.service.snapshot(
          (manager) =>
            this.service.summary(userId, catalogue, movements, false, manager),
          scopedManager,
        );
        return {
          ...financePage(result.rows.map(mapSummary), result.total, catalogue),
          scope: overviewScope(movements),
        };
      },
    );
  }
}
