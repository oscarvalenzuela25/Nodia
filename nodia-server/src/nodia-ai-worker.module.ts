import { NodiaAiSecureFlowModule } from './nodia-ai-secure-flow/nodia-ai-secure-flow.module.js';
import { Module } from '@nestjs/common';
import { NodiaCvModule } from './nodia-cv/nodia-cv.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { postgresConfig } from './config/db.config.js';
import { NodiaAiRuntimeModule } from './nodia-ai-runtime/nodia-ai-runtime.module.js';
import { NodiaAiConversationModule } from './nodia-ai-conversation/nodia-ai-conversation.module.js';
import { NodiaAiProcessingModule } from './nodia-ai-context/nodia-ai-processing.module.js';
import { NodiaAiRunModule } from './nodia-ai-run/nodia-ai-run.module.js';
import { NODIA_AI_MAINTENANCE_HANDLER } from './nodia-ai-runtime/types/worker.types.js';
import { MaintainNodiaAiRuntimeUseCase } from './nodia-ai-runtime/use-case/maintain-nodia-ai-runtime.use-case.js';
import { RunNodiaAiStageUseCase } from './nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.js';
import { RunNodiaAiWorkerUseCase } from './nodia-ai-runtime/use-case/run-nodia-ai-worker.use-case.js';
import { NodiaAiWorker } from './nodia-ai-runtime/nodia-ai.worker.js';
import { NodiaAiExecutionModule } from './nodia-ai-execution/nodia-ai-execution.module.js';
import { NodiaAiOperationsModule } from './nodia-ai-operations/nodia-ai-operations.module.js';
import { TeacherModule } from './teacher/teacher.module.js';
import { ProviderVisitPlanningModule } from './provider-visit-planning/provider-visit-planning.module.js';
import { ProviderVisitDeliveryModule } from './visit-notifications/delivery/provider-visit-delivery.module.js';

/** Standalone process: importing the HTTP app never starts these consumers. */
@Module({
  imports: [
    NodiaCvModule,
    TypeOrmModule.forRoot(postgresConfig),
    NodiaAiRuntimeModule,
    NodiaAiConversationModule,
    NodiaAiProcessingModule,
    NodiaAiRunModule,
    NodiaAiExecutionModule,
    NodiaAiSecureFlowModule,
    NodiaAiOperationsModule,
    TeacherModule,
    ProviderVisitPlanningModule,
    ProviderVisitDeliveryModule,
  ],
  providers: [
    RunNodiaAiStageUseCase,
    RunNodiaAiWorkerUseCase,
    NodiaAiWorker,
    MaintainNodiaAiRuntimeUseCase,
    {
      provide: NODIA_AI_MAINTENANCE_HANDLER,
      useExisting: MaintainNodiaAiRuntimeUseCase,
    },
  ],
})
export class NodiaAiWorkerModule {}
