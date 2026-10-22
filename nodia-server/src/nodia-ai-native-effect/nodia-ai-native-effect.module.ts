import { Module } from '@nestjs/common';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiFinanceEffectModule } from '../nodia-ai-finance-effect/nodia-ai-finance-effect.module.js';
import { ExecuteNodiaAiLocalEffectUseCase } from './use-case/execute-nodia-ai-local-effect.use-case.js';
@Module({
  imports: [NodiaAiProposalModule, NodiaAiFinanceEffectModule],
  providers: [ExecuteNodiaAiLocalEffectUseCase],
  exports: [ExecuteNodiaAiLocalEffectUseCase],
})
export class NodiaAiNativeEffectModule {}
