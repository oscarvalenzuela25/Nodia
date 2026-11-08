import { Module } from '@nestjs/common';
import { NodiaAiPreferenceOperationsModule } from '../nodia-ai-preference/nodia-ai-preference-operations.module.js';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
import { NodiaAiContextModule } from './nodia-ai-context.module.js';
import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { NodiaAiRuntimeModule } from '../nodia-ai-runtime/nodia-ai-runtime.module.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NODIA_AI_STAGE_HANDLER } from '../nodia-ai-runtime/types/worker.types.js';
import { ProcessNodiaAiStageUseCase } from './use-case/process-nodia-ai-stage.use-case.js';
import { NodiaAiToolsModule } from '../nodia-ai-tools/nodia-ai-tools.module.js';
import { NodiaAiContextSnapshotModule } from '../nodia-ai-context-snapshot/nodia-ai-context-snapshot.module.js';
import { BuildNodiaAiCompactionUseCase } from './use-case/build-nodia-ai-compaction.use-case.js';
import { LoadNodiaAiRecoveryRefsUseCase } from './use-case/load-nodia-ai-recovery-refs.use-case.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiInvoiceOcrModule } from '../nodia-ai-invoice-ocr/nodia-ai-invoice-ocr.module.js';

@Module({
  imports: [
    NodiaAiInvoiceOcrModule,
    NodiaAiContextSnapshotModule,
    NodiaAiProposalModule,
    NodiaAiConfirmationModule,
    NodiaAiPreferenceOperationsModule,
    NodiaAiAttachmentModule,
    NodiaAiContextModule,
    NodiaAiAdapterModule,
    NodiaAiRuntimeModule,
    NodiaAiAuthorizationModule,
    NodiaAiToolsModule,
  ],
  providers: [
    BuildNodiaAiCompactionUseCase,
    LoadNodiaAiRecoveryRefsUseCase,
    ProcessNodiaAiStageUseCase,
    {
      provide: NODIA_AI_STAGE_HANDLER,
      useExisting: ProcessNodiaAiStageUseCase,
    },
  ],
  exports: [NODIA_AI_STAGE_HANDLER, ProcessNodiaAiStageUseCase],
})
export class NodiaAiProcessingModule {}
