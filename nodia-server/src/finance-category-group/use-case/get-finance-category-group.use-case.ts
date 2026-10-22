import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { financeCategoryGroupDetail } from '../types/finance-category-group.types.js';

@Injectable()
export class GetFinanceCategoryGroupUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(actor: FinanceActor, id: string) {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: actorId }) => {
        const group = await this.service.findOwned(actorId, id, scopedManager);
        if (!group)
          throw new NotFoundException('finance:category_group_not_found');
        return financeCategoryGroupDetail(
          group,
          await this.service.categories(actorId, id, scopedManager),
        );
      },
    );
  }
}
