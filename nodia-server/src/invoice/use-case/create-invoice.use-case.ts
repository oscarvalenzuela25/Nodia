import { Injectable } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import { InvoiceService } from '../invoice.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { randomUUID } from 'node:crypto';
import { validateInvoiceFile } from '../invoice-file-validation.js';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly storageService: StorageService,
  ) {}

  async execute(dto: CreateInvoiceDto, file?: Express.Multer.File) {
    if (file) {
      const extension = validateInvoiceFile(file);
      const storageKey = `invoices/${dto.business_id}/${randomUUID()}.${extension}`;
      const pathStorage = await this.storageService.uploadFile(
        storageKey,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      );
      dto.path_storage = pathStorage;
    } else if (!dto.path_storage) {
      dto.path_storage = '';
    }

    return this.invoiceService.createInvoice(dto);
  }
}
