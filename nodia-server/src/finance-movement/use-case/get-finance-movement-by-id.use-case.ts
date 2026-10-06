import { Injectable } from '@nestjs/common';
import { FinanceMovementService } from '../finance-movement.service.js';
import { requireOwned } from '../../finance-obligation/use-case/finance-ledger.rules.js';
import { projectMovement } from '../types/finance-movement.types.js';

@Injectable()
export class GetFinanceMovementByIdUseCase {
  constructor(private readonly movements: FinanceMovementService) {}
  async execute(userId: string, id: string) {
    return projectMovement(
      requireOwned(await this.movements.findOne(userId, id)),
    );
  }
}
