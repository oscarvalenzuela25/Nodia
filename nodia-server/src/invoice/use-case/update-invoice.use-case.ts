import { ConflictException, Injectable } from '@nestjs/common';
import { UpdateInvoiceDto } from '../dto/update-invoice.dto.js';
import { InvoiceService } from '../invoice.service.js';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';

@Injectable()
export class UpdateInvoiceUseCase {
  constructor(private readonly invoiceService: InvoiceService) {}

  async execute(
    id: string,
    dto: UpdateInvoiceDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (manager && !manager.queryRunner?.isTransactionActive)
      throw new ConflictException(
        'Invoice effect requires an active transaction',
      );
    if (actor)
      return this.invoiceService.updateInvoice(id, dto, manager, actor);
    return manager
      ? this.invoiceService.updateInvoice(id, dto, manager)
      : this.invoiceService.updateInvoice(id, dto);
  }
}
