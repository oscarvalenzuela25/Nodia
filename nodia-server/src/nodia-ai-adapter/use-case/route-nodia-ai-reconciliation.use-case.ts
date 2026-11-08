import { Injectable } from '@nestjs/common';
import {
  NodiaAiRuntimeReconciliationPort,
  type NodiaAiRuntimeProofRequest,
  type NodiaAiRuntimeTerminalProof,
} from '../../nodia-ai-runtime/types/reconciliation.types.js';
import {
  readRuntimeProofRequest,
  runtimeProofDescriptor,
} from '../../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';
import { ReconcileGeminiNodiaAiRuntimeUseCase } from './reconcile-gemini-nodia-ai-runtime.use-case.js';
import { ReconcileCodexNodiaAiRuntimeUseCase } from './reconcile-codex-nodia-ai-runtime.use-case.js';
import { ApiNodiaAiRuntimeService } from '../api-nodia-ai-runtime.service.js';

/** Cleanup deliberately does not consult mutable provider configuration. */
@Injectable()
export class RouteNodiaAiReconciliationUseCase extends NodiaAiRuntimeReconciliationPort {
  constructor(
    private readonly gemini: ReconcileGeminiNodiaAiRuntimeUseCase,
    private readonly codex: ReconcileCodexNodiaAiRuntimeUseCase,
    private readonly api: ApiNodiaAiRuntimeService,
  ) {
    super();
  }
  private adapter(
    request: NodiaAiRuntimeProofRequest,
  ): NodiaAiRuntimeReconciliationPort {
    const identity = readRuntimeProofRequest(runtimeProofDescriptor(request));
    if (identity.engine === 'api_key') return this.api;
    return identity.adapterIdentity ? this.codex : this.gemini;
  }
  async reconcile(request: NodiaAiRuntimeProofRequest, signal: AbortSignal) {
    return this.adapter(request).reconcile(request, signal);
  }
  async acknowledge(proof: NodiaAiRuntimeTerminalProof, signal: AbortSignal) {
    return this.adapter(proof).acknowledge(proof, signal);
  }
}
