import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryService } from '../finance-category.service.js';
import { financeCategoryResponse } from '../types/finance-category.types.js';

@Injectable()
export class GetFinanceCategoryUseCase {
  constructor(private readonly service: FinanceCategoryService) {}
  async execute(actor: FinanceActor, id: string) {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: actorId }) => {
        const category = await this.service.findOwned(
          actorId,
          id,
          scopedManager,
        );
        if (!category)
          throw new NotFoundException('finance:category_not_found');
        return financeCategoryResponse(category);
      },
    );
  }
}
