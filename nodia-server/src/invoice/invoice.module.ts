import { Module } from '@nestjs/common';
import { InvoicePersistenceModule } from './invoice-persistence.module.js';
import { InvoiceController } from './invoice.controller.js';

// Invoices use cases
import { GetAllInvoicesUseCase } from './use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from './use-case/get-invoice-by-id.use-case.js';
import { GetInvoiceViewUrlUseCase } from './use-case/get-invoice-view-url.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import { VerifyIaProvidersUseCase } from './use-case/verify-ia-providers.use-case.js';
import { StorageModule } from '../common/storage/storage.module.js';
import { GeminiModule } from '../common/ai/gemini.module.js';
import { ProviderModule } from '../provider/provider.module.js';
import { AiProviderModule } from '../ai-provider/ai-provider.module.js';
import { AnalysisObservationsUseCase } from './use-case/analysis-observations.use-case.js';
import { AnalysisObservationInterceptor } from './analysis-observation.interceptor.js';
import { InvoiceUploadRecoveryWorker } from './invoice-upload-recovery.worker.js';

@Module({
  imports: [
    InvoicePersistenceModule,
    StorageModule,
    GeminiModule,
    ProviderModule,
    AiProviderModule,
  ],
  controllers: [InvoiceController],
  providers: [
    AnalysisObservationsUseCase,
    AnalysisObservationInterceptor,
    // Invoices
    GetAllInvoicesUseCase,
    GetInvoiceByIdUseCase,
    GetInvoiceViewUrlUseCase,
    InvoiceUploadRecoveryWorker,
    AnalyzeInvoiceUseCase,
    VerifyIaProvidersUseCase,
  ],
  exports: [InvoicePersistenceModule, VerifyIaProvidersUseCase],
})
export class InvoiceModule {}
