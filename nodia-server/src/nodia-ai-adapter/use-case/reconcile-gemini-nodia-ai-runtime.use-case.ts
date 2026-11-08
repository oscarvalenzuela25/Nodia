import { Injectable } from '@nestjs/common';
import { NodiaAiAdapterTransport } from '../nodia-ai-adapter.service.js';
import {
  NodiaAiRuntimeReconciliationPort,
  type NodiaAiRuntimeProofRequest,
  type NodiaAiRuntimeTerminalProof,
  type NodiaAiGeminiRuntimeProofRequest,
} from '../../nodia-ai-runtime/types/reconciliation.types.js';

function record(input: unknown): Record<string, unknown> | null {
  return input !== null && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function valid(request: NodiaAiRuntimeProofRequest): asserts request is NodiaAiGeminiRuntimeProofRequest {
  if (
    request.adapterIdentity !== undefined ||
    !['web', 'agentic'].includes(request.engine) ||
    !uuid.test(request.attemptId) ||
    !/^gemini-profile:[a-f0-9]{64}$/.test(request.resourceKey) ||
    !/^[a-f0-9]{32}$/.test(request.sessionGeneration) ||
    request.operationRef !== request.attemptId
  )
    throw Error('nodia_ai:invalid_reconciliation');
}
function payload(request: NodiaAiRuntimeProofRequest) {
  return {
    resource_key: request.resourceKey,
    session_generation: request.sessionGeneration,
    operation_ref: request.operationRef,
  };
}
@Injectable()
export class ReconcileGeminiNodiaAiRuntimeUseCase extends NodiaAiRuntimeReconciliationPort {
  constructor(private readonly transport: NodiaAiAdapterTransport) {
    super();
  }
  async reconcile(
    request: NodiaAiRuntimeProofRequest,
    signal: AbortSignal,
  ): Promise<NodiaAiRuntimeTerminalProof> {
    valid(request);
    const response = record(
      await this.transport.request(
        `/nodia-ai/${request.engine}/attempts/${request.attemptId}/reconcile`,
        payload(request),
        signal,
      ),
    );
    const keys = [
      'attempt_id',
      'resource_key',
      'session_generation',
      'operation_ref',
      'terminal_proof_id',
      'process_closed',
      'outcome',
      'observed_at',
    ];
    if (
      !response ||
      Object.keys(response).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(response, key)) ||
      response.attempt_id !== request.attemptId ||
      response.resource_key !== request.resourceKey ||
      response.session_generation !== request.sessionGeneration ||
      response.operation_ref !== request.operationRef ||
      typeof response.terminal_proof_id !== 'string' ||
      !uuid.test(response.terminal_proof_id) ||
      response.process_closed !== true ||
      !['completed', 'abandoned_unknown'].includes(String(response.outcome)) ||
      typeof response.observed_at !== 'string'
    )
      throw Error('nodia_ai:invalid_terminal_proof');
    const observedAt = new Date(response.observed_at);
    if (
      !Number.isFinite(observedAt.getTime()) ||
      observedAt.getTime() > Date.now() + 5000
    )
      throw Error('nodia_ai:invalid_terminal_proof');
    return Object.freeze({
      ...request,
      terminalProofId: response.terminal_proof_id,
      processClosed: true,
      outcome: response.outcome as 'completed' | 'abandoned_unknown',
      observedAt,
    });
  }
  async acknowledge(
    proof: NodiaAiRuntimeTerminalProof,
    signal: AbortSignal,
  ): Promise<void> {
    valid(proof);
    if (!uuid.test(proof.terminalProofId) || proof.processClosed !== true)
      throw Error('nodia_ai:invalid_terminal_proof');
    const response = record(
      await this.transport.request(
        `/nodia-ai/${proof.engine}/attempts/${proof.attemptId}/acknowledge`,
        { ...payload(proof), terminal_proof_id: proof.terminalProofId },
        signal,
      ),
    );
    if (
      !response ||
      Object.keys(response).length !== 1 ||
      response.acknowledged !== true
    )
      throw Error('nodia_ai:reconciliation_cleanup_pending');
  }
}
