import { Injectable } from '@nestjs/common';
import { GetInvoicesDto } from '../dto/get-invoices.dto.js';
import { InvoiceService } from '../invoice.service.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';

@Injectable()
export class GetAllInvoicesUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(queryParams: GetInvoicesDto, actor?: ActorReference) {
    return actor
      ? this.invoiceService.findAllInvoices(queryParams, actor)
      : this.invoiceService.findAllInvoices(queryParams);
  }
}
