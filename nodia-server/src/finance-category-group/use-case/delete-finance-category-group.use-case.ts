import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { throwFinanceCatalogError } from '../../finance-category/use-case/finance-catalog-errors.js';

@Injectable()
export class DeleteFinanceCategoryGroupUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(userId: string, id: string): Promise<void> {
    try {
      await this.service.transaction(async (manager) => {
        if (!(await this.service.findOwned(userId, id, manager, true)))
          throw new NotFoundException('finance:category_group_not_found');
        await this.service.deleteMemberships(manager, userId, id);
        await this.service.deleteOwned(manager, userId, id);
      });
    } catch (error) {
      throwFinanceCatalogError(error);
    }
  }
}
