import { ConflictException, Injectable } from '@nestjs/common';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto.js';
import { InvoiceService } from '../invoice.service.js';
import type { EntityManager } from 'typeorm';

@Injectable()
export class UpdateInvoiceUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(id: string, dto: UpdateInvoiceDto, manager?: EntityManager) {
    if (manager && !manager.queryRunner?.isTransactionActive)
      throw new ConflictException('Invoice effect requires an active transaction');
    return manager
      ? this.invoiceService.updateInvoice(id, dto, manager)
      : this.invoiceService.updateInvoice(id, dto);
  }
}
