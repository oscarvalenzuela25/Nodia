import { ConflictException, Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import {
  repaymentType,
  requireOwned,
} from '../../finance-obligation/use-case/finance-ledger.rules.js';

@Injectable()
export class DeleteFinanceMovementUseCase {
  constructor(private readonly ledger: FinanceLedgerService) {}
  async execute(userId: string, id: string): Promise<void> {
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
      if (obligation && movement.type !== repaymentType(obligation))
        throw new ConflictException('finance:delete_initial_on_obligation');
      await this.ledger.deleteMovement(manager, userId, id);
    });
  }
}
