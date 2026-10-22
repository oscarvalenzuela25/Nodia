import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
@Injectable()
export class GetRentalOperationUseCase {
  constructor(private readonly transactions: RentalTransactionService) {}
  execute(actor: ActorReference, propertyId: string, requestKey: string) {
    return this.transactions.recover(actor, propertyId, requestKey);
  }
}
