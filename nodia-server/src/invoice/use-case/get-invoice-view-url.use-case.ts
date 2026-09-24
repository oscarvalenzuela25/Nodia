import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceService } from '../invoice.service.js';
import { StorageService } from '../../common/storage/storage.service.js';

@Injectable()
export class GetInvoiceViewUrlUseCase {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly storageService: StorageService,
  ) {}

  async execute(id: string): Promise<{ url: string; path_storage: string }> {
    const invoice = await this.invoiceService.findOneInvoice(id);

    if (!invoice.path_storage || invoice.path_storage.trim().length === 0) {
      throw new BadRequestException(
        'The invoice does not have an associated file or storage path.',
      );
    }

    const url = await this.storageService.getSignedFileUrl(invoice.path_storage);

    return {
      url,
      path_storage: invoice.path_storage,
    };
  }
}
