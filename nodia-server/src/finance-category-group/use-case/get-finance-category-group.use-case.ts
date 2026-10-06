import { Injectable, NotFoundException } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { financeCategoryGroupDetail } from '../types/finance-category-group.types.js';

@Injectable()
export class GetFinanceCategoryGroupUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(actorId: string, id: string) {
    const group = await this.service.findOwned(actorId, id);
    if (!group) throw new NotFoundException('finance:category_group_not_found');
    return financeCategoryGroupDetail(
      group,
      await this.service.categories(actorId, id),
    );
  }
}
