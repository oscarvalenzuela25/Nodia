import { Injectable } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
@Injectable()
export class GetRentalOperationUseCase {
  constructor(private readonly transactions: RentalTransactionService) {}
  execute(actorId: string, propertyId: string, requestKey: string) {
    return this.transactions.recover(actorId, propertyId, requestKey);
  }
}
