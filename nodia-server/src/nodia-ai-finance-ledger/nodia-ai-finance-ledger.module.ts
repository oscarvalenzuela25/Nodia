import { Module } from '@nestjs/common';
import { FinanceMovementModule } from '../finance-movement/finance-movement.module.js';
import { FinanceObligationModule } from '../finance-obligation/finance-obligation.module.js';
import { BuildNodiaAiFinanceLedgerOperationsUseCase } from './use-case/build-nodia-ai-finance-ledger-operations.use-case.js';

@Module({
  imports: [FinanceMovementModule, FinanceObligationModule],
  providers: [BuildNodiaAiFinanceLedgerOperationsUseCase],
  exports: [BuildNodiaAiFinanceLedgerOperationsUseCase],
})
export class NodiaAiFinanceLedgerModule {}
