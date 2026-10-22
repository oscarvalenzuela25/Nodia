import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiExecutionStoreModule } from '../nodia-ai-execution/nodia-ai-execution-store.module.js';
import { PauseNodiaAiSecureFlowUseCase } from './use-case/pause-nodia-ai-secure-flow.use-case.js';
import { ManageNodiaAiSecureFlowUseCase } from './use-case/manage-nodia-ai-secure-flow.use-case.js';
import { NodiaAiSecureFlowController } from './nodia-ai-secure-flow.controller.js';
import { AuthSessionRevocationModule } from '../auth/auth-session-revocation.module.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { RecoverNodiaAiSecureFlowsUseCase } from './use-case/recover-nodia-ai-secure-flows.use-case.js';

/** Runtime composition is separate from the preparation module to keep dependencies acyclic. */
@Module({
  imports: [
    AiProviderModule,
    AuthSessionRevocationModule,
    NodiaAiConfirmationModule,
    NodiaAiProposalModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiAuthorizationModule,
    NodiaAiExecutionStoreModule,
  ],
  providers: [
    PauseNodiaAiSecureFlowUseCase,
    ManageNodiaAiSecureFlowUseCase,
    RecoverNodiaAiSecureFlowsUseCase,
  ],
  controllers: [NodiaAiSecureFlowController],
  exports: [
    PauseNodiaAiSecureFlowUseCase,
    ManageNodiaAiSecureFlowUseCase,
    RecoverNodiaAiSecureFlowsUseCase,
  ],
})
export class NodiaAiSecureFlowModule {}
