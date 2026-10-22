import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { throwFinanceCatalogError } from '../../finance-category/use-case/finance-catalog-errors.js';

@Injectable()
export class DeleteFinanceCategoryGroupUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(actor: FinanceActor, id: string): Promise<void> {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: userId }) => {
        try {
          await this.service.transaction(async (manager) => {
            if (!(await this.service.findOwned(userId, id, manager, true)))
              throw new NotFoundException('finance:category_group_not_found');
            await this.service.deleteMemberships(manager, userId, id);
            await this.service.deleteOwned(manager, userId, id);
          }, scopedManager);
        } catch (error) {
          throwFinanceCatalogError(error);
        }
      },
    );
  }
}
