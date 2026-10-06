import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { rentalPropertyResponse } from '../types/rental-property.types.js';

@Injectable()
export class GetRentalPropertyUseCase {
  constructor(private readonly transactions: RentalTransactionService) {}
  execute(actorId: string, propertyId: string) {
    return this.transactions.read(actorId, propertyId, async (ctx) =>
      rentalPropertyResponse(ctx.property, ctx.owner),
    );
  }
}
