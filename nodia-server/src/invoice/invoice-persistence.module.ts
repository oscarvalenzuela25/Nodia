import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module.js';
import { Invoice } from './entities/invoice.entity.js';
import { InvoiceUpload } from './entities/invoice-upload.entity.js';
import { InvoiceService } from './invoice.service.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import { UpdateInvoiceUseCase } from './use-case/update-invoice.use-case.js';
import { RecoverInvoiceUploadsUseCase } from './use-case/recover-invoice-uploads.use-case.js';

/** Shared writers only. Importing a SQL port never starts OCR or the upload daemon. */
@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceUpload]), StorageModule],
  providers: [InvoiceService, CreateInvoiceUseCase, UpdateInvoiceUseCase, RecoverInvoiceUploadsUseCase],
  exports: [InvoiceService, CreateInvoiceUseCase, UpdateInvoiceUseCase, RecoverInvoiceUploadsUseCase],
})
export class InvoicePersistenceModule {}
