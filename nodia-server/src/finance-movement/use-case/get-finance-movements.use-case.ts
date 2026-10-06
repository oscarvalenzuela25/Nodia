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
  async execute(userId: string, query: FinanceQueryDto) {
    validateFinanceQuery(query, 'movements');
    const [data, total] = await this.movements.list(userId, query);
    return financePage(data.map(projectMovement), total, query);
  }
}
