import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceService } from '../invoice.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { assertInvoiceFileScope } from '../invoice-file-scope.js';

@Injectable()
export class GetInvoiceViewUrlUseCase {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly storageService: StorageService,
  ) {}

  async execute(
    id: string,
    actor?: ActorReference,
  ): Promise<{ url: string; path_storage: string }> {
    const invoice = actor
      ? await this.invoiceService.findOneInvoice(id, actor.transaction, actor)
      : await this.invoiceService.findOneInvoice(id);

    if (!invoice.path_storage || invoice.path_storage.trim().length === 0) {
      throw new BadRequestException(
        'The invoice does not have an associated file or storage path.',
      );
    }

    assertInvoiceFileScope(invoice.path_storage, invoice.business_id);
    const url = await this.storageService.getSignedFileUrl(
      invoice.path_storage,
    );
    if (actor)
      await this.invoiceService.assertBusinessAccess(
        invoice.business_id,
        actor,
      );

    return {
      url,
      path_storage: invoice.path_storage,
    };
  }
}
