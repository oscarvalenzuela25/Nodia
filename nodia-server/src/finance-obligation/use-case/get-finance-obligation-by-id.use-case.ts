import type { FinanceActor } from '../../authorization/authority-transaction.js';
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
  async execute(actor: FinanceActor, id: string) {
    return this.obligations.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
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
        }, scopedManager);
      },
    );
  }
}
