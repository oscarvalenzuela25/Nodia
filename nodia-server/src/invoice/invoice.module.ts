import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceController } from './invoice.controller.js';

// Invoices use cases
import { GetAllInvoicesUseCase } from './use-case/get-all-invoices.use-case.js';
import { GetInvoiceByIdUseCase } from './use-case/get-invoice-by-id.use-case.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from './use-case/update-invoice.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import { StorageModule } from '../common/storage/storage.module.js';
import { GeminiModule } from '../common/ai/gemini.module.js';
import { ProviderModule } from '../provider/provider.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    StorageModule,
    GeminiModule,
    ProviderModule,
  ],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    // Invoices
    GetAllInvoicesUseCase,
    GetInvoiceByIdUseCase,
    CreateInvoiceUseCase,
    UpdateInvoiceUseCase,
    AnalyzeInvoiceUseCase,
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}
