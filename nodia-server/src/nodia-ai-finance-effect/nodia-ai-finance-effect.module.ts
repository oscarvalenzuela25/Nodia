import { Module } from '@nestjs/common';
import { FinanceMovementModule } from '../finance-movement/finance-movement.module.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { ExecuteNodiaAiFinanceMovementEffectUseCase } from './use-case/execute-nodia-ai-finance-movement-effect.use-case.js';
import { ExecuteNodiaAiFinanceEffectUseCase } from './use-case/execute-nodia-ai-finance-effect.use-case.js';

@Module({
  imports: [NodiaAiProposalModule, FinanceMovementModule],
  providers: [
    ExecuteNodiaAiFinanceMovementEffectUseCase,
    ExecuteNodiaAiFinanceEffectUseCase,
  ],
  exports: [
    ExecuteNodiaAiFinanceMovementEffectUseCase,
    ExecuteNodiaAiFinanceEffectUseCase,
  ],
})
export class NodiaAiFinanceEffectModule {}
