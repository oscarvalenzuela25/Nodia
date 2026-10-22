import { NodiaAiJournalModule } from '../nodia-ai-recovery/nodia-ai-journal.module.js';
import { Module } from '@nestjs/common';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
import { CleanupNodiaAiAttachmentsUseCase } from './use-case/cleanup-nodia-ai-attachments.use-case.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiJob } from './entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from './entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiExecutionGrant } from './entities/nodia-ai-execution-grant.entity.js';
import { NodiaAiRuntimeSlot } from './entities/nodia-ai-runtime-slot.entity.js';
import { NodiaAiAuditEvent } from './entities/nodia-ai-audit-event.entity.js';
import { NodiaAiRuntimeService } from './nodia-ai-runtime.service.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from './config/runtime-policy.module.js';
import { ClaimNodiaAiJobUseCase } from './use-case/claim-nodia-ai-job.use-case.js';
import { CheckpointNodiaAiJobUseCase } from './use-case/checkpoint-nodia-ai-job.use-case.js';
import { RecoverNodiaAiJobsUseCase } from './use-case/recover-nodia-ai-jobs.use-case.js';
import { RetryNodiaAiJobUseCase } from './use-case/retry-nodia-ai-job.use-case.js';
import { ReserveNodiaAiRuntimeSlotUseCase } from './use-case/reserve-nodia-ai-runtime-slot.use-case.js';
import { ReleaseNodiaAiRuntimeSlotUseCase } from './use-case/release-nodia-ai-runtime-slot.use-case.js';
import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { ReconcileNodiaAiRuntimeUseCase } from './use-case/reconcile-nodia-ai-runtime.use-case.js';
import { CleanupNodiaAiRuntimeProofsUseCase } from './use-case/cleanup-nodia-ai-runtime-proofs.use-case.js';
@Module({
  imports: [
    NodiaAiJournalModule,
    NodiaAiAttachmentModule,
    NodiaAiAuthorizationModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiAdapterModule,
    TypeOrmModule.forFeature([
      NodiaAiJob,
      NodiaAiJobAttempt,
      NodiaAiExecutionGrant,
      NodiaAiRuntimeSlot,
      NodiaAiAuditEvent,
    ]),
  ],
  providers: [
    CleanupNodiaAiAttachmentsUseCase,
    NodiaAiRuntimeService,
    ClaimNodiaAiJobUseCase,
    CheckpointNodiaAiJobUseCase,
    RecoverNodiaAiJobsUseCase,
    RetryNodiaAiJobUseCase,
    ReserveNodiaAiRuntimeSlotUseCase,
    ReleaseNodiaAiRuntimeSlotUseCase,
    ReconcileNodiaAiRuntimeUseCase,
    CleanupNodiaAiRuntimeProofsUseCase,
  ],
  exports: [
    CleanupNodiaAiAttachmentsUseCase,
    NodiaAiRuntimeService,
    NodiaAiRuntimePolicyModule,
    ClaimNodiaAiJobUseCase,
    CheckpointNodiaAiJobUseCase,
    RecoverNodiaAiJobsUseCase,
    RetryNodiaAiJobUseCase,
    ReserveNodiaAiRuntimeSlotUseCase,
    ReleaseNodiaAiRuntimeSlotUseCase,
    ReconcileNodiaAiRuntimeUseCase,
    CleanupNodiaAiRuntimeProofsUseCase,
  ],
})
export class NodiaAiRuntimeModule {}
