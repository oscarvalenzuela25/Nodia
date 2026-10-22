import { Module } from '@nestjs/common';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiOperationsService } from './nodia-ai-operations.service.js';
import { ObserveNodiaAiOperationsUseCase } from './use-case/observe-nodia-ai-operations.use-case.js';
import { ReportNodiaAiOperationsUseCase } from './use-case/report-nodia-ai-operations.use-case.js';

/** Worker/operator composition only; deliberately has no HTTP controller or scheduler. */
@Module({
  imports: [NodiaAiRuntimePolicyModule],
  providers: [
    NodiaAiOperationsService,
    ObserveNodiaAiOperationsUseCase,
    ReportNodiaAiOperationsUseCase,
  ],
  exports: [ObserveNodiaAiOperationsUseCase, ReportNodiaAiOperationsUseCase],
})
export class NodiaAiOperationsModule {}
