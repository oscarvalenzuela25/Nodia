import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceMovementService } from '../finance-movement.service.js';
import { requireOwned } from '../../finance-obligation/use-case/finance-ledger.rules.js';
import { projectMovement } from '../types/finance-movement.types.js';

@Injectable()
export class GetFinanceMovementByIdUseCase {
  constructor(private readonly movements: FinanceMovementService) {}
  async execute(actor: FinanceActor, id: string) {
    return this.movements.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        return projectMovement(
          requireOwned(await this.movements.findOne(userId, id, scopedManager)),
        );
      },
    );
  }
}
