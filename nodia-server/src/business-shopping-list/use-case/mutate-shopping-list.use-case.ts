import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { BusinessShoppingListService } from '../business-shopping-list.service.js';
import type {
  ChangeShoppingListActivityDto,
  CreateShoppingListDto,
  EditShoppingListDto,
  SetShoppingListCheckDto,
} from '../dto/shopping-list.dto.js';
import {
  assertShoppingListItemIdentities,
  normalizeShoppingListContent,
  shoppingListCreateHash,
} from '../policies/shopping-list-content.js';
import { ShoppingListScope } from '../shopping-list-scope.js';
import type {
  ShoppingListCheck,
  ShoppingListDetail,
  ShoppingListItemCommand,
} from '../types/shopping-list.types.js';

@Injectable()
export class MutateShoppingListUseCase {
  constructor(
    private readonly scope: ShoppingListScope,
    private readonly lists: BusinessShoppingListService,
  ) {}

  create(
    businessId: string,
    body: CreateShoppingListDto,
    actor: ActorReference,
  ): Promise<ShoppingListDetail> {
    const content = normalizeShoppingListContent(body, false);
    const requestHash = shoppingListCreateHash(content);
    return this.scope.run(businessId, actor, async (manager, actorId) => {
      await this.lists.lockCreateKey(
        manager,
        businessId,
        actorId,
        body.request_key,
      );
      const receipt = await this.lists.findCreateReceipt(
        manager,
        businessId,
        actorId,
        body.request_key,
      );
      if (receipt) {
        if (receipt.request_hash !== requestHash)
          throw new ConflictException(
            'business:shopping_list_request_conflict',
          );
        return receipt.result;
      }

      const products = await this.lockNewProducts(
        manager,
        businessId,
        content.items,
      );
      const listId = await this.lists.insertList(
        manager,
        businessId,
        content.name,
      );
      await this.lists.replaceItems(
        manager,
        businessId,
        listId,
        content.items,
        products,
      );
      const result = await this.detail(manager, businessId, listId);
      await this.lists.recordCreateReceipt(
        manager,
        businessId,
        actorId,
        body.request_key,
        requestHash,
        result,
      );
      return result;
    });
  }

  edit(
    businessId: string,
    listId: string,
    body: EditShoppingListDto,
    actor: ActorReference,
  ): Promise<ShoppingListDetail> {
    const content = normalizeShoppingListContent(body, true);
    return this.scope.run(businessId, actor, async (manager) => {
      await this.lockContent(manager, businessId, listId, body.version);
      const existingItems = await this.lists.itemIdentities(
        manager,
        businessId,
        listId,
      );
      assertShoppingListItemIdentities(content.items, existingItems);
      const products = await this.lockNewProducts(
        manager,
        businessId,
        content.items,
      );
      await this.lists.replaceItems(
        manager,
        businessId,
        listId,
        content.items,
        products,
      );
      await this.lists.rename(manager, businessId, listId, content.name);
      return this.detail(manager, businessId, listId);
    });
  }

  changeActivity(
    businessId: string,
    listId: string,
    body: ChangeShoppingListActivityDto,
    actor: ActorReference,
  ): Promise<ShoppingListDetail> {
    return this.scope.run(businessId, actor, async (manager) => {
      await this.lockContent(manager, businessId, listId, body.version);
      await this.lists.changeActivity(
        manager,
        businessId,
        listId,
        body.is_active,
      );
      return this.detail(manager, businessId, listId);
    });
  }

  setCheck(
    businessId: string,
    listId: string,
    itemId: string,
    body: SetShoppingListCheckDto,
    actor: ActorReference,
  ): Promise<ShoppingListCheck> {
    return this.scope.run(businessId, actor, async (manager, actorId) => {
      // Share the parent among checklist writers but serialize against composition changes.
      if (!(await this.lists.lockList(manager, businessId, listId, false)))
        throw new NotFoundException('business:resource_not_found');
      const item = await this.lists.lockCheck(
        manager,
        businessId,
        listId,
        itemId,
      );
      if (!item) throw new NotFoundException('business:resource_not_found');
      if (item.check_version !== body.check_version)
        throw new ConflictException('business:shopping_list_check_conflict');
      if (item.checked === body.checked) return item;
      return this.lists.updateCheck(
        manager,
        businessId,
        listId,
        itemId,
        body.checked,
        actorId,
      );
    });
  }

  private async lockContent(
    manager: EntityManager,
    businessId: string,
    listId: string,
    version: number,
  ): Promise<void> {
    const list = await this.lists.lockList(manager, businessId, listId, true);
    if (!list) throw new NotFoundException('business:resource_not_found');
    if (list.version !== version)
      throw new ConflictException('business:shopping_list_version_conflict');
  }

  private async lockNewProducts(
    manager: EntityManager,
    businessId: string,
    items: readonly ShoppingListItemCommand[],
  ): Promise<ReadonlyMap<string, string>> {
    const ids = items
      .filter(({ item_id }) => item_id === undefined)
      .map(({ product_id }) => product_id);
    const products = await this.lists.lockAvailableProducts(
      manager,
      businessId,
      ids,
    );
    if (products.size !== ids.length)
      throw new ConflictException('business:shopping_list_product_unavailable');
    return products;
  }

  private async detail(
    manager: EntityManager,
    businessId: string,
    listId: string,
  ): Promise<ShoppingListDetail> {
    const detail = await this.lists.detail(manager, businessId, listId);
    if (!detail) throw new NotFoundException('business:resource_not_found');
    return detail;
  }
}
