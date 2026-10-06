import { Injectable } from '@nestjs/common';
import { FinanceObligationService } from '../finance-obligation.service.js';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import {
  financePage,
  validateFinanceQuery,
} from '../../finance-common/finance-query.js';
import {
  projectObligation,
  requireInitialMovement,
} from './finance-ledger.rules.js';
import type { FinanceMovement } from '../../finance-movement/entities/finance-movement.entity.js';

@Injectable()
export class GetFinanceObligationsUseCase {
  constructor(private readonly obligations: FinanceObligationService) {}
  async execute(userId: string, query: FinanceQueryDto) {
    validateFinanceQuery(query, 'obligations');
    return this.obligations.snapshot(async (manager) => {
      const [data, total] = await this.obligations.list(userId, query, manager);
      const { initial, payments } = await this.obligations.settlement(
        userId,
        data,
        manager,
      );
      const initialById = new Map<string, FinanceMovement[]>();
      for (const movement of initial) {
        const id = movement.obligation_id!;
        const records = initialById.get(id) ?? [];
        records.push(movement);
        initialById.set(id, records);
      }
      const paidById = new Map(
        payments.map((payment) => [payment.obligation_id, payment.amount]),
      );
      return financePage(
        data.map((obligation) =>
          projectObligation(
            obligation,
            requireInitialMovement(initialById.get(obligation.id) ?? []),
            paidById.get(obligation.id) ?? '0',
          ),
        ),
        total,
        query,
      );
    });
  }
}
