import type { FinanceActor } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { FinanceCategoryGroupService } from '../finance-category-group.service.js';
import { FinanceQueryDto } from '../../finance-common/dto/finance-query.dto.js';
import { financePage } from '../../finance-common/finance-query.js';
import { financeCategoryGroupResponse } from '../types/finance-category-group.types.js';

@Injectable()
export class GetFinanceCategoryGroupsUseCase {
  constructor(private readonly service: FinanceCategoryGroupService) {}
  async execute(actor: FinanceActor, query: FinanceQueryDto) {
    return this.service.withScope(
      actor,
      async ({ manager: scopedManager, ownerId: actorId }) => {
        const [groups, total] = await this.service.findPage(
          actorId,
          query,
          scopedManager,
        );
        const counts = await this.service.categoryCounts(
          actorId,
          groups.map((group) => group.id),
          scopedManager,
        );
        return financePage(
          groups.map((group) =>
            financeCategoryGroupResponse(group, counts.get(group.id) ?? 0),
          ),
          total,
          query,
        );
      },
    );
  }
}
