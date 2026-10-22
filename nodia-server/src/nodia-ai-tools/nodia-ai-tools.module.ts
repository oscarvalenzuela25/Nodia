import { Module } from '@nestjs/common';
import { NodiaAiContextModule } from '../nodia-ai-context/nodia-ai-context.module.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiToolRegistryModule } from './nodia-ai-tool-registry.module.js';
import { NodiaAiToolsService } from './nodia-ai-tools.service.js';
import { NodiaAiCapabilitiesController } from './nodia-ai-capabilities.controller.js';
import { QueryNodiaAiCapabilitiesUseCase } from './use-case/query-nodia-ai-capabilities.use-case.js';
import { ExecuteNodiaAiToolUseCase } from './use-case/execute-nodia-ai-tool.use-case.js';
import { NodiaAiReportsModule } from '../nodia-ai-reports/nodia-ai-reports.module.js';

@Module({
  imports: [
    NodiaAiContextModule,
    NodiaAiToolRegistryModule,
    NodiaAiAuthorizationModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiReportsModule,
  ],
  controllers: [NodiaAiCapabilitiesController],
  providers: [
    NodiaAiToolsService,
    QueryNodiaAiCapabilitiesUseCase,
    ExecuteNodiaAiToolUseCase,
  ],
  exports: [ExecuteNodiaAiToolUseCase],
})
export class NodiaAiToolsModule {}
