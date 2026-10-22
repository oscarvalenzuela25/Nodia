import { Module } from '@nestjs/common';
import { NodiaAiRuntimeReconciliationPort } from '../nodia-ai-runtime/types/reconciliation.types.js';
import { ReconcileGeminiNodiaAiRuntimeUseCase } from './use-case/reconcile-gemini-nodia-ai-runtime.use-case.js';
import { NodiaAiAdapterTransport } from './nodia-ai-adapter.service.js';
import { NodiaAiAdapterPort } from './types/nodia-ai-adapter.types.js';
import { GeminiNodiaAiAdapterUseCase } from './use-case/gemini-nodia-ai-adapter.use-case.js';

@Module({
  providers: [
    NodiaAiAdapterTransport,
    GeminiNodiaAiAdapterUseCase,
    ReconcileGeminiNodiaAiRuntimeUseCase,
    {
      provide: NodiaAiRuntimeReconciliationPort,
      useExisting: ReconcileGeminiNodiaAiRuntimeUseCase,
    },
    { provide: NodiaAiAdapterPort, useExisting: GeminiNodiaAiAdapterUseCase },
  ],
  exports: [NodiaAiAdapterPort, NodiaAiRuntimeReconciliationPort],
})
export class NodiaAiAdapterModule {}
