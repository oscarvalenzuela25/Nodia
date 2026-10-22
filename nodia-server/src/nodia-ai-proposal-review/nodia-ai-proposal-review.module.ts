import { Module } from '@nestjs/common';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiProposalReviewController } from './nodia-ai-proposal-review.controller.js';
import { GetNodiaAiProposalReviewUseCase } from './use-case/get-nodia-ai-proposal-review.use-case.js';
@Module({
  imports: [
    NodiaAiProposalModule,
    NodiaAiConfirmationModule,
    NodiaAiRuntimePolicyModule,
  ],
  providers: [GetNodiaAiProposalReviewUseCase],
  controllers: [NodiaAiProposalReviewController],
})
export class NodiaAiProposalReviewModule {}
