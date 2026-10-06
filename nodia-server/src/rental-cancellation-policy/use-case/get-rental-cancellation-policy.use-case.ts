import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalCancellationPolicyService } from '../rental-cancellation-policy.service.js';
import { rentalCancellationPolicyResponse } from '../types/rental-cancellation-policy.types.js';

@Injectable()
export class GetRentalCancellationPolicyUseCase {
  constructor(
    private readonly transactions: RentalTransactionService,
    private readonly service: RentalCancellationPolicyService,
  ) {}
  execute(actorId: string, propertyId: string, id: string) {
    return this.transactions.read(actorId, propertyId, async (ctx) => {
      const row = await this.service.find(ctx.manager, propertyId, id);
      if (!row) throw new NotFoundException('rental:not_found');
      return rentalCancellationPolicyResponse(
        row,
        await this.service.rulesForPolicies(ctx.manager, propertyId, [id]),
      );
    });
  }
}
