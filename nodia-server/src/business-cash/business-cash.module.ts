import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { BusinessCashCategoriesController } from './business-cash-categories.controller.js';
import { BusinessCashMovementsController } from './business-cash-movements.controller.js';
import { BusinessCashReceiptsController } from './business-cash-receipts.controller.js';
import { CashBusinessScope } from './cash-business-scope.js';
import { CashMutationRequestsService } from './cash-mutation-requests.service.js';
import { BusinessCashCategory } from './entities/business-cash-category.entity.js';
import { BusinessCashMovement } from './entities/business-cash-movement.entity.js';
import { BusinessCashMovementAudit } from './entities/business-cash-movement-audit.entity.js';
import { BusinessCashMutationRequest } from './entities/business-cash-mutation-request.entity.js';
import { ExecuteCashMutationUseCase } from './use-case/execute-cash-mutation.use-case.js';
import { MutateCashCategoryUseCase } from './use-case/mutate-cash-category.use-case.js';
import { MutateCashMovementUseCase } from './use-case/mutate-cash-movement.use-case.js';
import { ReadCashCategoriesUseCase } from './use-case/read-cash-categories.use-case.js';
import { ReadCashMovementsUseCase } from './use-case/read-cash-movements.use-case.js';
import { ReadCashReceiptUseCase } from './use-case/read-cash-receipt.use-case.js';

@Module({
  imports: [
    AuthorizationModule,
    TypeOrmModule.forFeature([
      BusinessCashCategory,
      BusinessCashMovement,
      BusinessCashMovementAudit,
      BusinessCashMutationRequest,
    ]),
  ],
  controllers: [
    BusinessCashCategoriesController,
    BusinessCashMovementsController,
    BusinessCashReceiptsController,
  ],
  providers: [
    CashBusinessScope,
    CashMutationRequestsService,
    ExecuteCashMutationUseCase,
    MutateCashCategoryUseCase,
    MutateCashMovementUseCase,
    ReadCashCategoriesUseCase,
    ReadCashMovementsUseCase,
    ReadCashReceiptUseCase,
  ],
  exports: [
    CashBusinessScope,
    CashMutationRequestsService,
    ExecuteCashMutationUseCase,
    ReadCashCategoriesUseCase,
    ReadCashMovementsUseCase,
  ],
})
export class BusinessCashModule {}
