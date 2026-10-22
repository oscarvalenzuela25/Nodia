import { Module } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { NODIA_AI_ADMISSION_PREPARER } from '../nodia-ai-conversation/types/nodia-ai-admission.types.js';
import {
  NODIA_AI_KNOWLEDGE_PIN,
  NODIA_AI_KNOWLEDGE_ROOT,
  NODIA_AI_KNOWLEDGE_SCHEMA,
  NODIA_AI_REGISTERED_CAPABILITIES,
} from './types/knowledge.types.js';
import { LoadNodiaAiKnowledgeUseCase } from './use-case/load-nodia-ai-knowledge.use-case.js';
import { BuildNodiaAiContextUseCase } from './use-case/build-nodia-ai-context.use-case.js';
import { PrepareNodiaAiAdmissionUseCase } from './use-case/prepare-nodia-ai-admission.use-case.js';
import { ExecuteNodiaAiKnowledgeToolUseCase } from './use-case/execute-nodia-ai-knowledge-tool.use-case.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiToolRegistryModule } from '../nodia-ai-tools/nodia-ai-tool-registry.module.js';
import { NodiaAiToolRegistryUseCase } from '../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { DiscoverNodiaAiToolsUseCase } from '../nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.js';
import { NodiaAiReportsModule } from '../nodia-ai-reports/nodia-ai-reports.module.js';
import { NodiaAiReportToolsUseCase } from '../nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';
import { SelectNodiaAiTurnToolsUseCase } from '../nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case.js';
import { NodiaAiToolSelectionFlowUseCase } from '../nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';

@Module({
  imports: [
    NodiaAiRuntimePolicyModule,
    NodiaAiAdapterModule,
    NodiaAiAuthorizationModule,
    NodiaAiToolRegistryModule,
    NodiaAiReportsModule,
  ],
  providers: [
    {
      provide: NODIA_AI_KNOWLEDGE_ROOT,
      useFactory: () =>
        fileURLToPath(new URL('../nodia-ai/knowledge/', import.meta.url)),
    },
    {
      provide: NODIA_AI_KNOWLEDGE_PIN,
      useFactory: () =>
        JSON.parse(
          readFileSync(
            new URL('./config/knowledge-pin.json', import.meta.url),
            'utf8',
          ),
        ) as unknown,
    },
    {
      provide: NODIA_AI_KNOWLEDGE_SCHEMA,
      useFactory: () =>
        readFileSync(
          new URL('./config/knowledge-schema.json', import.meta.url),
        ),
    },
    {
      provide: NODIA_AI_REGISTERED_CAPABILITIES,
      inject: [NodiaAiToolRegistryUseCase],
      useFactory: (registry: NodiaAiToolRegistryUseCase) =>
        registry.publishedContracts(),
    },
    DiscoverNodiaAiToolsUseCase,
    SelectNodiaAiTurnToolsUseCase,
    NodiaAiToolSelectionFlowUseCase,
    NodiaAiReportToolsUseCase,
    LoadNodiaAiKnowledgeUseCase,
    BuildNodiaAiContextUseCase,
    PrepareNodiaAiAdmissionUseCase,
    ExecuteNodiaAiKnowledgeToolUseCase,
    {
      provide: NODIA_AI_ADMISSION_PREPARER,
      useExisting: PrepareNodiaAiAdmissionUseCase,
    },
  ],
  exports: [
    SelectNodiaAiTurnToolsUseCase,
    NodiaAiToolSelectionFlowUseCase,
    DiscoverNodiaAiToolsUseCase,
    NodiaAiReportToolsUseCase,
    ExecuteNodiaAiKnowledgeToolUseCase,
    NODIA_AI_ADMISSION_PREPARER,
    LoadNodiaAiKnowledgeUseCase,
    BuildNodiaAiContextUseCase,
  ],
})
export class NodiaAiContextModule {}
