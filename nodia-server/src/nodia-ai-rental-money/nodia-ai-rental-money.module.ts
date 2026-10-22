import { Module } from '@nestjs/common';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalPaymentModule } from '../rental-payment/rental-payment.module.js';
import { RentalExpenseModule } from '../rental-expense/rental-expense.module.js';
import { NodiaAiRentalMoneyService } from './nodia-ai-rental-money.service.js';
import { BuildNodiaAiRentalMoneyOperationsUseCase } from './use-case/build-nodia-ai-rental-money-operations.use-case.js';
import { NODIA_AI_RENTAL_MONEY_OPERATIONS } from './types/rental-money-operation.types.js';

@Module({
  imports: [RentalCommonModule, RentalPaymentModule, RentalExpenseModule],
  providers: [
    NodiaAiRentalMoneyService,
    BuildNodiaAiRentalMoneyOperationsUseCase,
    {
      provide: NODIA_AI_RENTAL_MONEY_OPERATIONS,
      inject: [BuildNodiaAiRentalMoneyOperationsUseCase],
      useFactory: (factory: BuildNodiaAiRentalMoneyOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [
    BuildNodiaAiRentalMoneyOperationsUseCase,
    NODIA_AI_RENTAL_MONEY_OPERATIONS,
  ],
})
export class NodiaAiRentalMoneyModule {}
