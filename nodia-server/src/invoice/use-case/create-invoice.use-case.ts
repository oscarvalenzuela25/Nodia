import { Injectable } from '@nestjs/common';
import { CreateInvoiceDto } from '../dto/create-invoice.dto.js';
import { InvoiceService } from '../invoice.service.js';
import { StorageService } from '../../common/storage/storage.service.js';

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly storageService: StorageService,
  ) {}

  async execute(dto: CreateInvoiceDto, file?: Express.Multer.File) {
    if (file && file.buffer && file.buffer.length > 0) {
      const sanitizedFilename = (file.originalname || 'document').replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );
      const storageKey = `invoices/${dto.business_id}/${Date.now()}-${sanitizedFilename}`;
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
