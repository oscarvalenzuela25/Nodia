import { NodiaAiJournalModule } from '../nodia-ai-recovery/nodia-ai-journal.module.js';
import { Module } from '@nestjs/common';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiNativeEffectModule } from '../nodia-ai-native-effect/nodia-ai-native-effect.module.js';
import { NodiaAiExecutionStoreModule } from './nodia-ai-execution-store.module.js';
import { ExecuteNodiaAiLocalExecutionUseCase } from './use-case/execute-nodia-ai-local-execution.use-case.js';
import { ClaimNodiaAiExecutionUseCase } from './use-case/claim-nodia-ai-execution.use-case.js';
import { RecoverNodiaAiExecutionsUseCase } from './use-case/recover-nodia-ai-executions.use-case.js';
import { RunNodiaAiExecutionUseCase } from './use-case/run-nodia-ai-execution.use-case.js';
import { NodiaAiSecureFlowModule } from '../nodia-ai-secure-flow/nodia-ai-secure-flow.module.js';
import { NodiaAiInvoiceAttachmentModule } from '../nodia-ai-invoice-attachment/nodia-ai-invoice-attachment.module.js';

/** Local SQL execution ports, consumed by the standalone worker. */
@Module({
  imports: [
    NodiaAiJournalModule,
    NodiaAiConfirmationModule,
    NodiaAiProposalModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiNativeEffectModule,
    NodiaAiSecureFlowModule,
    NodiaAiExecutionStoreModule,
    NodiaAiInvoiceAttachmentModule,
  ],
  providers: [
    ExecuteNodiaAiLocalExecutionUseCase,
    ClaimNodiaAiExecutionUseCase,
    RecoverNodiaAiExecutionsUseCase,
    RunNodiaAiExecutionUseCase,
  ],
  exports: [
    ExecuteNodiaAiLocalExecutionUseCase,
    ClaimNodiaAiExecutionUseCase,
    RecoverNodiaAiExecutionsUseCase,
    RunNodiaAiExecutionUseCase,
  ],
})
export class NodiaAiExecutionModule {}
