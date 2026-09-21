import { Injectable } from '@nestjs/common';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto.js';
import { InvoiceService } from '../invoice.service.js';

@Injectable()
export class UpdateInvoiceUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(id: string, dto: UpdateInvoiceDto) {
    return this.invoiceService.updateInvoice(id, dto);
  }
}
