import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../finance-ledger.service.js';
import {
  requireInitialMovement,
  requireOwned,
  requireNoRepayments,
} from './finance-ledger.rules.js';

@Injectable()
export class DeleteFinanceObligationUseCase {
  constructor(private readonly ledger: FinanceLedgerService) {}
  async execute(actor: FinanceActor, id: string): Promise<void> {
    return this.ledger.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        await this.ledger.transaction(async (manager) => {
          const obligation = requireOwned(
            await this.ledger.obligation(manager, userId, id),
          );
          requireNoRepayments(
            await this.ledger.hasRepayments(manager, obligation),
          );
          const initial = requireInitialMovement(
            await this.ledger.initialMovements(manager, obligation),
          );
          await this.ledger.deleteMovement(manager, userId, initial.id);
          await this.ledger.deleteObligation(manager, userId, id);
        }, scopedManager);
      },
    );
  }
}
