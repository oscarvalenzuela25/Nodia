import { Injectable } from '@nestjs/common';
import { InvoiceService } from '../invoice.service.js';

@Injectable()
export class GetInvoiceByIdUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(id: string) {
    return this.invoiceService.findOneInvoice(id);
  }
}
