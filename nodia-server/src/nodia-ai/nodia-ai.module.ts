import { Module } from '@nestjs/common';
import { NodiaAiAuthorizationModule } from './nodia-ai-authorization.module.js';
import { NodiaAiNavigationService } from './nodia-ai-navigation.service.js';
import { SeedNodiaAiNavigationUseCase } from './use-case/seed-nodia-ai-navigation.use-case.js';
import { NodiaAiConversationModule } from '../nodia-ai-conversation/nodia-ai-conversation.module.js';
import { NodiaAiRunModule } from '../nodia-ai-run/nodia-ai-run.module.js';
import { NodiaAiRuntimeModule } from '../nodia-ai-runtime/nodia-ai-runtime.module.js';
import { NodiaAiToolsModule } from '../nodia-ai-tools/nodia-ai-tools.module.js';
import { NodiaAiObservationModule } from '../nodia-ai-observation/nodia-ai-observation.module.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiProposalReviewModule } from '../nodia-ai-proposal-review/nodia-ai-proposal-review.module.js';
import { NodiaAiExecutionModule } from '../nodia-ai-execution/nodia-ai-execution.module.js';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
@Module({
  imports: [
    NodiaAiAuthorizationModule,
    NodiaAiConversationModule,
    NodiaAiRunModule,
    NodiaAiRuntimeModule,
    NodiaAiToolsModule,
    NodiaAiObservationModule,
    NodiaAiProposalModule,
    NodiaAiConfirmationModule,
    NodiaAiProposalReviewModule,
    NodiaAiExecutionModule,
    NodiaAiAttachmentModule,
  ],
  providers: [NodiaAiNavigationService, SeedNodiaAiNavigationUseCase],
  exports: [
    NodiaAiAuthorizationModule,
    NodiaAiConversationModule,
    NodiaAiRunModule,
    NodiaAiRuntimeModule,
  ],
})
export class NodiaAiModule {}
