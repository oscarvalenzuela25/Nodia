import type {
  NodiaAiRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../nodia-ai-runtime/types/reconciliation.types.js';
import { NodiaAiAdapterError } from './types/nodia-ai-adapter.types.js';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function parseNativeTerminalProof(
  input: unknown,
  expected: NodiaAiRuntimeProofRequest,
): NodiaAiRuntimeTerminalProof {
  const value =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;
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
    expected.adapterIdentity !== undefined ||
    !value ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key)) ||
    value.attempt_id !== expected.attemptId ||
    value.resource_key !== expected.resourceKey ||
    value.session_generation !== expected.sessionGeneration ||
    value.operation_ref !== expected.operationRef ||
    typeof value.terminal_proof_id !== 'string' ||
    !uuid.test(value.terminal_proof_id) ||
    value.process_closed !== true ||
    !['completed', 'abandoned_unknown'].includes(String(value.outcome)) ||
    typeof value.observed_at !== 'string'
  )
    throw new NodiaAiAdapterError('adapter_terminal_proof_invalid', 'unknown');
  const observedAt = new Date(value.observed_at);
  if (
    !Number.isFinite(observedAt.getTime()) ||
    observedAt.getTime() > Date.now() + 5000
  )
    throw new NodiaAiAdapterError('adapter_terminal_proof_invalid', 'unknown');
  return Object.freeze({
    ...expected,
    terminalProofId: value.terminal_proof_id,
    processClosed: true,
    outcome: value.outcome as 'completed' | 'abandoned_unknown',
    observedAt,
  });
}
