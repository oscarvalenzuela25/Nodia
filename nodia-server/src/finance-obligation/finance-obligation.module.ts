import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceCategory } from '../finance-category/entities/finance-category.entity.js';
import { FinanceMovement } from '../finance-movement/entities/finance-movement.entity.js';
import { FinanceObligation } from './entities/finance-obligation.entity.js';
import { FinanceLedgerService } from './finance-ledger.service.js';
import { FinanceObligationService } from './finance-obligation.service.js';
import { FinanceObligationController } from './finance-obligation.controller.js';
import { CreateFinanceObligationUseCase } from './use-case/create-finance-obligation.use-case.js';
import { UpdateFinanceObligationUseCase } from './use-case/update-finance-obligation.use-case.js';
import { GetFinanceObligationsUseCase } from './use-case/get-finance-obligations.use-case.js';
import { GetFinanceObligationByIdUseCase } from './use-case/get-finance-obligation-by-id.use-case.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceObligation,
      FinanceMovement,
      FinanceCategory,
    ]),
  ],
  controllers: [FinanceObligationController],
  providers: [
    FinanceLedgerService,
    FinanceObligationService,
    CreateFinanceObligationUseCase,
    UpdateFinanceObligationUseCase,
    GetFinanceObligationsUseCase,
    GetFinanceObligationByIdUseCase,
  ],
  exports: [FinanceLedgerService, FinanceObligationService],
})
export class FinanceObligationModule {}
