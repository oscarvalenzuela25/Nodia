import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceCategoryService } from '../finance-category.service.js';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import { financePage } from '../../finance-common/finance-query.js';
import { financeCategoryResponse } from '../types/finance-category.types.js';

@Injectable()
export class GetFinanceCategoriesUseCase {
  constructor(private readonly service: FinanceCategoryService) {}
  async execute(actor: FinanceActor, query: FinanceQueryDto) {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: actorId }) => {
        const [categories, total] = await this.service.findPage(
          actorId,
          query,
          scopedManager,
        );
        return financePage(
          categories.map(financeCategoryResponse),
          total,
          query,
        );
      },
    );
  }
}
