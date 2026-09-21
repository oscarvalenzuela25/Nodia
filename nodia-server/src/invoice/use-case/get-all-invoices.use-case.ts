import { Injectable } from '@nestjs/common';
import { GetInvoicesDto } from '../dto/get-invoices.dto.js';
import { InvoiceService } from '../invoice.service.js';

@Injectable()
export class GetAllInvoicesUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(queryParams: GetInvoicesDto) {
    return this.invoiceService.findAllInvoices(queryParams);
  }
}
