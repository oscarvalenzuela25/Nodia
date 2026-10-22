import { Module } from '@nestjs/common';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiExecutionStoreModule } from '../nodia-ai-execution/nodia-ai-execution-store.module.js';
import { StageNodiaAiInvoiceAttachmentUseCase } from './use-case/stage-nodia-ai-invoice-attachment.use-case.js';
@Module({
  imports: [
    NodiaAiAttachmentModule,
    NodiaAiConfirmationModule,
    NodiaAiProposalModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiExecutionStoreModule,
  ],
  providers: [StageNodiaAiInvoiceAttachmentUseCase],
  exports: [StageNodiaAiInvoiceAttachmentUseCase],
})
export class NodiaAiInvoiceAttachmentModule {}
