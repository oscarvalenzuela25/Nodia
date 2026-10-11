import { ConflictException, Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../finance-ledger.service.js';
import {
  requireInitialMovement,
  requireOwned,
} from './finance-ledger.rules.js';

@Injectable()
export class DeleteFinanceObligationUseCase {
  constructor(private readonly ledger: FinanceLedgerService) {}
  async execute(userId: string, id: string): Promise<void> {
    await this.ledger.transaction(async (manager) => {
      const obligation = requireOwned(
        await this.ledger.obligation(manager, userId, id),
      );
      if (await this.ledger.hasRepayments(manager, obligation))
        throw new ConflictException('finance:obligation_has_payments');
      const initial = requireInitialMovement(
        await this.ledger.initialMovements(manager, obligation),
      );
      await this.ledger.deleteMovement(manager, userId, initial.id);
      await this.ledger.deleteObligation(manager, userId, id);
    });
  }
}
