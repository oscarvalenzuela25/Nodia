import { Module } from '@nestjs/common';
import { FinanceOverviewController } from './finance-overview.controller.js';
import { FinanceOverviewService } from './finance-overview.service.js';
import { GetFinanceOverviewUseCase } from './use-case/get-finance-overview.use-case.js';
import { GetFinanceCategorySummaryUseCase } from './use-case/get-finance-category-summary.use-case.js';
import { GetFinanceGroupSummaryUseCase } from './use-case/get-finance-group-summary.use-case.js';

@Module({
  controllers: [FinanceOverviewController],
  providers: [
    FinanceOverviewService,
    GetFinanceOverviewUseCase,
    GetFinanceCategorySummaryUseCase,
    GetFinanceGroupSummaryUseCase,
  ],
})
export class FinanceOverviewModule {}
