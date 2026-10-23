import { Module } from '@nestjs/common';
import { NodiaAiRuntimeReconciliationPort } from '../nodia-ai-runtime/types/reconciliation.types.js';
import { ReconcileGeminiNodiaAiRuntimeUseCase } from './use-case/reconcile-gemini-nodia-ai-runtime.use-case.js';
import { NodiaAiAdapterTransport } from './nodia-ai-adapter.service.js';
import { NodiaAiAdapterPort } from './types/nodia-ai-adapter.types.js';
import { GeminiNodiaAiAdapterUseCase } from './use-case/gemini-nodia-ai-adapter.use-case.js';
import { CodexRuntimeModule } from '../common/ai/codex/codex-runtime.module.js';
import { CodexNodiaAiAdapterUseCase } from './use-case/codex-nodia-ai-adapter.use-case.js';
import { ReconcileCodexNodiaAiRuntimeUseCase } from './use-case/reconcile-codex-nodia-ai-runtime.use-case.js';
import { ResolveNodiaAiAdapterUseCase } from './use-case/resolve-nodia-ai-adapter.use-case.js';
import { RouteNodiaAiAdapterUseCase } from './use-case/route-nodia-ai-adapter.use-case.js';
import { RouteNodiaAiReconciliationUseCase } from './use-case/route-nodia-ai-reconciliation.use-case.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';

@Module({
  imports: [CodexRuntimeModule, NodiaAiRuntimePolicyModule],
  providers: [
    NodiaAiAdapterTransport,
    GeminiNodiaAiAdapterUseCase,
    ReconcileGeminiNodiaAiRuntimeUseCase,
    CodexNodiaAiAdapterUseCase,
    ReconcileCodexNodiaAiRuntimeUseCase,
    ResolveNodiaAiAdapterUseCase,
    RouteNodiaAiAdapterUseCase,
    RouteNodiaAiReconciliationUseCase,
    {
      provide: NodiaAiRuntimeReconciliationPort,
      useExisting: RouteNodiaAiReconciliationUseCase,
    },
    { provide: NodiaAiAdapterPort, useExisting: RouteNodiaAiAdapterUseCase },
  ],
  exports: [NodiaAiAdapterPort, NodiaAiRuntimeReconciliationPort],
})
export class NodiaAiAdapterModule {}
