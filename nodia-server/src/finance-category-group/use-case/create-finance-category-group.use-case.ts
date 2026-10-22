import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { CreateFinanceCategoryGroupDto } from '../dto/create-finance-category-group.dto.js';
import { financeCategoryGroupDetail } from '../types/finance-category-group.types.js';
import { syncFinanceGroupCategories } from './sync-finance-group-categories.js';
import { throwFinanceCatalogError } from '../../finance-category/use-case/finance-catalog-errors.js';

@Injectable()
export class CreateFinanceCategoryGroupUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(actor: FinanceActor, dto: CreateFinanceCategoryGroupDto) {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: actorId }) => {
        try {
          return await this.service.transaction(async (manager) => {
            const group = await this.service.insert(manager, {
              user_id: actorId,
              name: dto.name,
              key: dto.key,
              is_active: dto.is_active ?? true,
            });
            await syncFinanceGroupCategories(
              this.service,
              manager,
              actorId,
              group.id,
              dto.category_ids,
            );
            return financeCategoryGroupDetail(
              group,
              await this.service.categories(actorId, group.id, manager),
            );
          }, scopedManager);
        } catch (error) {
          throwFinanceCatalogError(error);
        }
      },
    );
  }
}
