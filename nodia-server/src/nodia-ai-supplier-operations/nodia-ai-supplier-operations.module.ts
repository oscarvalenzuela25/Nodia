import { Module } from '@nestjs/common';
import { ProviderModule } from '../provider/provider.module.js';
import { ProviderContactModule } from '../provider-contact/provider-contact.module.js';
import { NodiaAiSupplierOperationsService } from './nodia-ai-supplier-operations.service.js';
import { BuildNodiaAiSupplierOperationsUseCase } from './use-case/build-nodia-ai-supplier-operations.use-case.js';
@Module({
  imports: [ProviderModule, ProviderContactModule],
  providers: [
    NodiaAiSupplierOperationsService,
    BuildNodiaAiSupplierOperationsUseCase,
  ],
  exports: [BuildNodiaAiSupplierOperationsUseCase],
})
export class NodiaAiSupplierOperationsModule {}
