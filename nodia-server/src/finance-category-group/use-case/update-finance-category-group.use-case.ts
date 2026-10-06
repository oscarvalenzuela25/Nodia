import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { UpdateFinanceCategoryGroupDto } from '../dto/update-finance-category-group.dto.js';
import { financeCategoryGroupDetail } from '../types/finance-category-group.types.js';
import { syncFinanceGroupCategories } from './sync-finance-group-categories.js';
import { throwFinanceCatalogError } from '../../finance-category/use-case/finance-catalog-errors.js';

@Injectable()
export class UpdateFinanceCategoryGroupUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(
    actorId: string,
    id: string,
    dto: UpdateFinanceCategoryGroupDto,
  ) {
    try {
      return await this.service.transaction(async (manager) => {
        const group = await this.service.findOwned(actorId, id, manager, true);
        if (!group)
          throw new NotFoundException('finance:category_group_not_found');
        if (dto.category_ids !== undefined)
          await syncFinanceGroupCategories(
            this.service,
            manager,
            actorId,
            id,
            dto.category_ids,
          );
        if (dto.name !== undefined) group.name = dto.name;
        if (dto.key !== undefined) group.key = dto.key;
        if (dto.is_active !== undefined) group.is_active = dto.is_active;
        const saved = await this.service.save(manager, group);
        return financeCategoryGroupDetail(
          saved,
          await this.service.categories(actorId, id, manager),
        );
      });
    } catch (error) {
      throwFinanceCatalogError(error);
    }
  }
}
