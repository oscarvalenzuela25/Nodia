import { Module } from '@nestjs/common';
import { FinanceCategoryModule } from '../../finance-category/finance-category.module.js';
import { FinanceCategoryService } from '../../finance-category/finance-category.service.js';
import { GetFinanceCategoryUseCase } from '../../finance-category/use-case/get-finance-category.use-case.js';
import { GetFinanceCategoriesUseCase } from '../../finance-category/use-case/get-finance-categories.use-case.js';
import { FinanceCategoryGroupModule } from '../../finance-category-group/finance-category-group.module.js';
import { GetFinanceCategoryGroupUseCase } from '../../finance-category-group/use-case/get-finance-category-group.use-case.js';
import { GetFinanceCategoryGroupsUseCase } from '../../finance-category-group/use-case/get-finance-category-groups.use-case.js';
import { FinanceMovementModule } from '../../finance-movement/finance-movement.module.js';
import { GetFinanceMovementByIdUseCase } from '../../finance-movement/use-case/get-finance-movement-by-id.use-case.js';
import { GetFinanceMovementsUseCase } from '../../finance-movement/use-case/get-finance-movements.use-case.js';
import { FinanceObligationModule } from '../../finance-obligation/finance-obligation.module.js';
import { GetFinanceObligationByIdUseCase } from '../../finance-obligation/use-case/get-finance-obligation-by-id.use-case.js';
import { GetFinanceObligationsUseCase } from '../../finance-obligation/use-case/get-finance-obligations.use-case.js';
import { FinanceOverviewModule } from '../../finance-overview/finance-overview.module.js';
import { GetFinanceOverviewUseCase } from '../../finance-overview/use-case/get-finance-overview.use-case.js';
import { GetFinanceCategorySummaryUseCase } from '../../finance-overview/use-case/get-finance-category-summary.use-case.js';
import { GetFinanceGroupSummaryUseCase } from '../../finance-overview/use-case/get-finance-group-summary.use-case.js';
import {
  createNodiaAiFinanceReadFamily,
  NODIA_AI_FINANCE_READ_FAMILY,
} from './finance-read.family.js';

@Module({
  imports: [
    FinanceCategoryModule,
    FinanceCategoryGroupModule,
    FinanceMovementModule,
    FinanceObligationModule,
    FinanceOverviewModule,
  ],
  providers: [
    {
      provide: NODIA_AI_FINANCE_READ_FAMILY,
      inject: [
        FinanceCategoryService,
        GetFinanceCategoryUseCase,
        GetFinanceCategoriesUseCase,
        GetFinanceCategoryGroupUseCase,
        GetFinanceCategoryGroupsUseCase,
        GetFinanceMovementByIdUseCase,
        GetFinanceMovementsUseCase,
        GetFinanceObligationByIdUseCase,
        GetFinanceObligationsUseCase,
        GetFinanceOverviewUseCase,
        GetFinanceCategorySummaryUseCase,
        GetFinanceGroupSummaryUseCase,
      ],
      useFactory: (
        scope: FinanceCategoryService,
        category: GetFinanceCategoryUseCase,
        categories: GetFinanceCategoriesUseCase,
        group: GetFinanceCategoryGroupUseCase,
        groups: GetFinanceCategoryGroupsUseCase,
        movement: GetFinanceMovementByIdUseCase,
        movements: GetFinanceMovementsUseCase,
        obligation: GetFinanceObligationByIdUseCase,
        obligations: GetFinanceObligationsUseCase,
        overview: GetFinanceOverviewUseCase,
        byCategory: GetFinanceCategorySummaryUseCase,
        byGroup: GetFinanceGroupSummaryUseCase,
      ) =>
        createNodiaAiFinanceReadFamily({
          scope,
          category,
          categories,
          group,
          groups,
          movement,
          movements,
          obligation,
          obligations,
          overview,
          byCategory,
          byGroup,
        }),
    },
  ],
  exports: [NODIA_AI_FINANCE_READ_FAMILY],
})
export class NodiaAiFinanceReadModule {}
