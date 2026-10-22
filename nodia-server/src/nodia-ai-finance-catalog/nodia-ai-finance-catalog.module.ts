import { Module } from '@nestjs/common';
import { FinanceCategoryModule } from '../finance-category/finance-category.module.js';
import { FinanceCategoryGroupModule } from '../finance-category-group/finance-category-group.module.js';
import { NodiaAiFinanceCatalogService } from './nodia-ai-finance-catalog.service.js';
import { BuildNodiaAiFinanceCatalogOperationsUseCase } from './use-case/build-nodia-ai-finance-catalog-operations.use-case.js';

@Module({
  imports: [FinanceCategoryModule, FinanceCategoryGroupModule],
  providers: [
    NodiaAiFinanceCatalogService,
    BuildNodiaAiFinanceCatalogOperationsUseCase,
  ],
  exports: [BuildNodiaAiFinanceCatalogOperationsUseCase],
})
export class NodiaAiFinanceCatalogModule {}
