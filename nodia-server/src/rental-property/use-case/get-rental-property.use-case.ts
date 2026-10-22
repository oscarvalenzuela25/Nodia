import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { rentalPropertyResponse } from '../types/rental-property.types.js';

@Injectable()
export class GetRentalPropertyUseCase {
  constructor(private readonly transactions: RentalTransactionService) {}
  async execute(actor: ActorReference, propertyId: string) {
    return this.transactions.read(actor, propertyId, async (ctx) =>
      rentalPropertyResponse(ctx.property, ctx.owner, ctx.isSuperAdmin),
    );
  }
}
