import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceController } from './invoice.controller.js';

// Invoices use cases
import { GetAllInvoicesUseCase } from './use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from './use-case/get-invoice-by-id.use-case.js';
import { GetInvoiceViewUrlUseCase } from './use-case/get-invoice-view-url.use-case.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from './use-case/update-invoice.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import { VerifyIaProvidersUseCase } from './use-case/verify-ia-providers.use-case.js';
import { StorageModule } from '../common/storage/storage.module.js';
import { GeminiModule } from '../common/ai/gemini.module.js';
import { ProviderModule } from '../provider/provider.module.js';
import { AiProviderModule } from '../ai-provider/ai-provider.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    StorageModule,
    GeminiModule,
    ProviderModule,
    AiProviderModule,
  ],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    // Invoices
    GetAllInvoicesUseCase,
    GetInvoiceByIdUseCase,
    GetInvoiceViewUrlUseCase,
    CreateInvoiceUseCase,
    UpdateInvoiceUseCase,
    AnalyzeInvoiceUseCase,
    VerifyIaProvidersUseCase,
  ],
  exports: [InvoiceService, VerifyIaProvidersUseCase],
})
export class InvoiceModule {}
