import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BusinessCashCategoriesController } from './business-cash-categories.controller.js';
import { BusinessCashReceiptsController } from './business-cash-receipts.controller.js';
import { CashBusinessScope } from './cash-business-scope.js';
import { CashMutationRequestsService } from './cash-mutation-requests.service.js';
import { BusinessCashCategory } from './entities/business-cash-category.entity.js';
import { BusinessCashMutationRequest } from './entities/business-cash-mutation-request.entity.js';
import { MutateCashCategoryUseCase } from './use-case/mutate-cash-category.use-case.js';
import { ReadCashCategoriesUseCase } from './use-case/read-cash-categories.use-case.js';
import { ReadCashReceiptUseCase } from './use-case/read-cash-receipt.use-case.js';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([
      BusinessCashCategory,
      BusinessCashMutationRequest,
    ]),
  ],
  controllers: [
    BusinessCashCategoriesController,
    BusinessCashReceiptsController,
  ],
  providers: [
    CashBusinessScope,
    CashMutationRequestsService,
    MutateCashCategoryUseCase,
    ReadCashCategoriesUseCase,
    ReadCashReceiptUseCase,
  ],
})
export class BusinessCashModule {}
