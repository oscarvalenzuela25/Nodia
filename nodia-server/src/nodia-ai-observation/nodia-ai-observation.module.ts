import { Module } from '@nestjs/common';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiConversationModule } from '../nodia-ai-conversation/nodia-ai-conversation.module.js';
import { NodiaAiContextModule } from '../nodia-ai-context/nodia-ai-context.module.js';
import { NodiaAiToolRegistryModule } from '../nodia-ai-tools/nodia-ai-tool-registry.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiObservationService } from './nodia-ai-observation.service.js';
import { NodiaAiObservationController } from './nodia-ai-observation.controller.js';
import { ObserveNodiaAiRunUseCase } from './use-case/observe-nodia-ai-run.use-case.js';
import { GetNodiaAiToolResultUseCase } from './use-case/get-nodia-ai-tool-result.use-case.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { ObserveNodiaAiProposalsUseCase } from './use-case/observe-nodia-ai-proposals.use-case.js';

@Module({
  imports: [
    NodiaAiAuthorizationModule,
    NodiaAiConversationModule,
    NodiaAiContextModule,
    NodiaAiToolRegistryModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiProposalModule,
  ],
  providers: [
    NodiaAiObservationService,
    ObserveNodiaAiRunUseCase,
    GetNodiaAiToolResultUseCase,
    ObserveNodiaAiProposalsUseCase,
  ],
  controllers: [NodiaAiObservationController],
})
export class NodiaAiObservationModule {}
