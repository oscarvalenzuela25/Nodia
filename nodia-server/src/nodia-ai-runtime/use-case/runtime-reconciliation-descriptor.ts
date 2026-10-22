import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../types/reconciliation.types.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function readRuntimeProofRequest(
  value: unknown,
): NodiaAiRuntimeProofRequest {
  const descriptor = record(value),
    runtime = record(descriptor?.runtime);
  if (
    descriptor?.schema_version !== 1 ||
    !runtime ||
    Object.keys(runtime).length !== 5 ||
    !['web', 'agentic'].includes(String(runtime.engine)) ||
    typeof runtime.attempt_id !== 'string' ||
    !uuid.test(runtime.attempt_id) ||
    runtime.operation_ref !== runtime.attempt_id ||
    typeof runtime.resource_key !== 'string' ||
    !/^gemini-profile:[a-f0-9]{64}$/.test(runtime.resource_key) ||
    typeof runtime.session_generation !== 'string' ||
    !/^[a-f0-9]{32}$/.test(runtime.session_generation)
  )
    throw Error('nodia_ai:reconciliation_identity_missing');
  return {
    engine: runtime.engine as 'web' | 'agentic',
    attemptId: runtime.attempt_id,
    resourceKey: runtime.resource_key,
    sessionGeneration: runtime.session_generation,
    operationRef: runtime.operation_ref,
  };
}
export function runtimeProofDescriptor(
  request: NodiaAiRuntimeProofRequest,
): NodiaAiJsonObject {
  return {
    schema_version: 1,
    runtime: {
      engine: request.engine,
      attempt_id: request.attemptId,
      resource_key: request.resourceKey,
      session_generation: request.sessionGeneration,
      operation_ref: request.operationRef,
    },
  };
}
export function readTerminalProof(value: unknown): NodiaAiRuntimeTerminalProof {
  const request = readRuntimeProofRequest(value),
    descriptor = record(value),
    terminal = record(descriptor?.terminal_proof);
  if (
    !terminal ||
    Object.keys(terminal).length !== 3 ||
    typeof terminal.id !== 'string' ||
    !uuid.test(terminal.id) ||
    !['completed', 'abandoned_unknown'].includes(String(terminal.outcome)) ||
    typeof terminal.observed_at !== 'string'
  )
    throw Error('nodia_ai:invalid_terminal_proof');
  const observedAt = new Date(terminal.observed_at);
  if (!Number.isFinite(observedAt.getTime()))
    throw Error('nodia_ai:invalid_terminal_proof');
  return {
    ...request,
    terminalProofId: terminal.id,
    processClosed: true,
    outcome: terminal.outcome as 'completed' | 'abandoned_unknown',
    observedAt,
  };
}
export function assertRuntimeTerminalProof(
  request: NodiaAiRuntimeProofRequest,
  proof: NodiaAiRuntimeTerminalProof,
): void {
  if (
    proof.engine !== request.engine ||
    proof.attemptId !== request.attemptId ||
    proof.operationRef !== request.operationRef ||
    proof.resourceKey !== request.resourceKey ||
    proof.sessionGeneration !== request.sessionGeneration ||
    !uuid.test(proof.terminalProofId) ||
    proof.processClosed !== true ||
    !['completed', 'abandoned_unknown'].includes(proof.outcome) ||
    !(proof.observedAt instanceof Date) ||
    !Number.isFinite(proof.observedAt.getTime())
  )
    throw Error('nodia_ai:invalid_terminal_proof');
}
export function terminalRuntimeProofDescriptor(
  proof: NodiaAiRuntimeTerminalProof,
): NodiaAiJsonObject {
  return {
    ...runtimeProofDescriptor(proof),
    terminal_proof: {
      id: proof.terminalProofId,
      outcome: proof.outcome,
      observed_at: proof.observedAt.toISOString(),
    },
    cleanup_attempts: 0,
  };
}
