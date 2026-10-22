import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module.js';
import { ProductModule } from '../product/product.module.js';
import { NodiaAiBusinessCatalogService } from './nodia-ai-business-catalog.service.js';
import { BuildNodiaAiBusinessCatalogOperationsUseCase } from './use-case/build-nodia-ai-business-catalog-operations.use-case.js';
@Module({
  imports: [BusinessModule, ProductModule],
  providers: [
    NodiaAiBusinessCatalogService,
    BuildNodiaAiBusinessCatalogOperationsUseCase,
  ],
  exports: [BuildNodiaAiBusinessCatalogOperationsUseCase],
})
export class NodiaAiBusinessCatalogModule {}
