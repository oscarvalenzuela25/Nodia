import { Injectable } from '@nestjs/common';
import { InvoiceService } from '../invoice.service.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';

@Injectable()
export class GetInvoiceByIdUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(id: string, actor?: ActorReference) {
    return actor
      ? this.invoiceService.findOneInvoice(id, actor.transaction, actor)
      : this.invoiceService.findOneInvoice(id);
  }
}
