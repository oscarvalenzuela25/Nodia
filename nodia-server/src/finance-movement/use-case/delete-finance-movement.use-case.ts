import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import {
  requireDeletableMovement,
  requireOwned,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';

@Injectable()
export class DeleteFinanceMovementUseCase {
  constructor(private readonly ledger: FinanceLedgerService) {}
  async execute(actor: FinanceActor, id: string): Promise<void> {
    return this.ledger.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        await this.ledger.transaction(async (manager) => {
          const snapshot = requireOwned(
            await this.ledger.movement(manager, userId, id, false),
          );
          // Same lock order as every linked writer: obligation, then movement.
          const obligation = snapshot.obligation_id
            ? requireOwned(
                await this.ledger.obligation(
                  manager,
                  userId,
                  snapshot.obligation_id,
                ),
              )
            : null;
          const movement = requireOwned(
            await this.ledger.movement(manager, userId, id),
          );
          requireDeletableMovement(movement, obligation);
          await this.ledger.deleteMovement(manager, userId, id);
        }, scopedManager);
      },
    );
  }
}
