import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceMovementService } from '../finance-movement.service.js';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import {
  financePage,
  validateFinanceQuery,
} from '../../finance-common/finance-query.js';
import { projectMovement } from '../types/finance-movement.types.js';

@Injectable()
export class GetFinanceMovementsUseCase {
  constructor(private readonly movements: FinanceMovementService) {}
  async execute(actor: FinanceActor, query: FinanceQueryDto) {
    return this.movements.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        validateFinanceQuery(query, 'movements');
        const [data, total] = await this.movements.list(
          userId,
          query,
          scopedManager,
        );
        return financePage(data.map(projectMovement), total, query);
      },
    );
  }
}
