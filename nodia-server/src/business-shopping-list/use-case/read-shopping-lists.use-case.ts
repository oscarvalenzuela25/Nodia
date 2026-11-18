import { Injectable, NotFoundException } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { BusinessShoppingListService } from '../business-shopping-list.service.js';
import type { ShoppingListQueryDto } from '../dto/shopping-list.dto.js';
import { shoppingListSearchPattern } from '../policies/shopping-list-content.js';
import { ShoppingListScope } from '../shopping-list-scope.js';
import type {
  ShoppingListDetail,
  ShoppingListPage,
} from '../types/shopping-list.types.js';

@Injectable()
export class ReadShoppingListsUseCase {
  constructor(
    private readonly scope: ShoppingListScope,
    private readonly lists: BusinessShoppingListService,
  ) {}

  list(
    businessId: string,
    query: ShoppingListQueryDto,
    actor: ActorReference,
  ): Promise<ShoppingListPage> {
    const { page = 1, limit = 20, search = '' } = query;
    return this.scope.run(businessId, actor, async (manager) => {
      const { items, total } = await this.lists.list(manager, businessId, {
        page,
        limit,
        search: shoppingListSearchPattern(search),
      });
      return {
        items,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      };
    });
  }

  detail(
    businessId: string,
    listId: string,
    actor: ActorReference,
  ): Promise<ShoppingListDetail> {
    return this.scope.run(businessId, actor, async (manager) => {
      const detail = await this.lists.detail(manager, businessId, listId);
      if (!detail) throw new NotFoundException('business:resource_not_found');
      return detail;
    });
  }

  receipt(
    businessId: string,
    requestKey: string,
    actor: ActorReference,
  ): Promise<ShoppingListDetail> {
    return this.scope.run(businessId, actor, async (manager, actorId) => {
      const receipt = await this.lists.findCreateReceipt(
        manager,
        businessId,
        actorId,
        requestKey,
      );
      if (!receipt) throw new NotFoundException('business:resource_not_found');
      return receipt.result;
    });
  }
}
