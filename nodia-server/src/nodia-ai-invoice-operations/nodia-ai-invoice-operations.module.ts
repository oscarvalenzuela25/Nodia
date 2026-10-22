import { Module } from '@nestjs/common';
import { InvoicePersistenceModule } from '../invoice/invoice-persistence.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiInvoiceOperationsService } from './nodia-ai-invoice-operations.service.js';
import { BuildNodiaAiInvoiceOperationsUseCase } from './use-case/build-nodia-ai-invoice-operations.use-case.js';

@Module({
  imports: [InvoicePersistenceModule, NodiaAiRuntimePolicyModule],
  providers: [
    NodiaAiInvoiceOperationsService,
    BuildNodiaAiInvoiceOperationsUseCase,
  ],
  exports: [BuildNodiaAiInvoiceOperationsUseCase],
})
export class NodiaAiInvoiceOperationsModule {}
