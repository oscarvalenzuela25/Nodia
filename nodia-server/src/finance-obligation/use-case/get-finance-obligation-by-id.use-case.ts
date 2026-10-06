import { Injectable } from '@nestjs/common';
import { FinanceObligationService } from '../finance-obligation.service.js';
import {
  projectObligation,
  requireInitialMovement,
  requireOwned,
} from './finance-ledger.rules.js';

@Injectable()
export class GetFinanceObligationByIdUseCase {
  constructor(private readonly obligations: FinanceObligationService) {}
  async execute(userId: string, id: string) {
    return this.obligations.snapshot(async (manager) => {
      const obligation = requireOwned(
        await this.obligations.findOne(userId, id, manager),
      );
      const { initial, payments } = await this.obligations.settlement(
        userId,
        [obligation],
        manager,
      );
      return projectObligation(
        obligation,
        requireInitialMovement(initial),
        payments[0]?.amount ?? '0',
      );
    });
  }
}
