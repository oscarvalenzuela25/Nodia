import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import { FinanceMovementService } from '../finance-movement.service.js';
import { UpdateFinanceMovementDto } from '../dto/update-finance-movement.dto.js';
import { requireOwned } from '../../finance-obligation/use-case/finance-ledger.rules.js';
import { resolveFinanceMovementUpdate } from './resolve-finance-movement-update.js';
import { projectMovement } from '../types/finance-movement.types.js';

@Injectable()
export class UpdateFinanceMovementUseCase {
  constructor(
    private readonly ledger: FinanceLedgerService,
    private readonly movements: FinanceMovementService,
  ) {}

  async execute(
    actor: FinanceActor,
    id: string,
    dto: UpdateFinanceMovementDto,
  ) {
    return this.ledger.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        return this.ledger.transaction(async (manager) => {
          const { next } = await resolveFinanceMovementUpdate(
            this.ledger,
            manager,
            userId,
            id,
            dto,
          );
          await this.ledger.saveMovement(manager, next);
          return projectMovement(
            requireOwned(await this.movements.findOne(userId, id, manager)),
          );
        }, scopedManager);
      },
    );
  }
}
