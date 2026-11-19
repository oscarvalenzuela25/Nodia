import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BusinessShoppingListController } from './business-shopping-list.controller.js';
import { BusinessShoppingListService } from './business-shopping-list.service.js';
import { BusinessShoppingListCreateRequest } from './entities/business-shopping-list-create-request.entity.js';
import { BusinessShoppingListItem } from './entities/business-shopping-list-item.entity.js';
import { BusinessShoppingList } from './entities/business-shopping-list.entity.js';
import { ShoppingListScope } from './shopping-list-scope.js';
import { MutateShoppingListUseCase } from './use-case/mutate-shopping-list.use-case.js';
import { ReadShoppingListsUseCase } from './use-case/read-shopping-lists.use-case.js';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([
      BusinessShoppingList,
      BusinessShoppingListItem,
      BusinessShoppingListCreateRequest,
    ]),
  ],
  controllers: [BusinessShoppingListController],
  providers: [
    BusinessShoppingListService,
    ShoppingListScope,
    ReadShoppingListsUseCase,
    MutateShoppingListUseCase,
  ],
  exports: [ReadShoppingListsUseCase],
})
export class BusinessShoppingListModule {}
