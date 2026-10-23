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
function canonicalConnectionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}
export function readRuntimeProofRequest(
  value: unknown,
): NodiaAiRuntimeProofRequest {
  const descriptor = record(value),
    runtime = record(descriptor?.runtime);
  if (descriptor?.schema_version === 2) {
    if (
      !runtime ||
      Object.keys(runtime).length !== 8 ||
      ![
        'provider_key',
        'adapter_contract_version',
        'connection_id',
        'engine',
        'attempt_id',
        'operation_ref',
        'resource_key',
        'session_generation',
      ].every((key) => Object.hasOwn(runtime, key)) ||
      runtime.provider_key !== 'openai' ||
      runtime.adapter_contract_version !== 'nodia-ai-codex-chat/1' ||
      runtime.engine !== 'agentic' ||
      !canonicalConnectionId(runtime.connection_id) ||
      typeof runtime.attempt_id !== 'string' ||
      !uuid.test(runtime.attempt_id) ||
      runtime.operation_ref !== runtime.attempt_id ||
      typeof runtime.resource_key !== 'string' ||
      !/^codex-profile:[a-f0-9]{64}$/.test(runtime.resource_key) ||
      typeof runtime.session_generation !== 'string' ||
      !/^[a-f0-9]{32}$/.test(runtime.session_generation)
    )
      throw Error('nodia_ai:reconciliation_identity_missing');
    return {
      engine: 'agentic',
      attemptId: runtime.attempt_id,
      resourceKey: runtime.resource_key,
      sessionGeneration: runtime.session_generation,
      operationRef: runtime.operation_ref,
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: runtime.connection_id,
      },
    };
  }
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
  if (request.adapterIdentity !== undefined) {
    const identity = record(request.adapterIdentity);
    if (
      !identity ||
      Object.keys(identity).length !== 3 ||
      !['providerKey', 'contractVersion', 'connectionId'].every((key) =>
        Object.hasOwn(identity, key),
      ) ||
      identity.providerKey !== 'openai' ||
      identity.contractVersion !== 'nodia-ai-codex-chat/1' ||
      !canonicalConnectionId(identity.connectionId)
    )
      throw Error('nodia_ai:reconciliation_identity_missing');
    const descriptor: NodiaAiJsonObject = {
      schema_version: 2,
      runtime: {
        provider_key: identity.providerKey,
        adapter_contract_version: identity.contractVersion,
        connection_id: identity.connectionId,
        engine: request.engine,
        attempt_id: request.attemptId,
        resource_key: request.resourceKey,
        session_generation: request.sessionGeneration,
        operation_ref: request.operationRef,
      },
    };
    // Validate before persisting: TypeScript alone cannot validate runtime callers.
    readRuntimeProofRequest(descriptor);
    return descriptor;
  }
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
  try {
    const expected = readRuntimeProofRequest(runtimeProofDescriptor(request)),
      received = readRuntimeProofRequest(runtimeProofDescriptor(proof));
    if (expected.adapterIdentity || received.adapterIdentity) {
      if (
        !expected.adapterIdentity ||
        !received.adapterIdentity ||
        expected.adapterIdentity.providerKey !==
          received.adapterIdentity.providerKey ||
        expected.adapterIdentity.contractVersion !==
          received.adapterIdentity.contractVersion ||
        expected.adapterIdentity.connectionId !==
          received.adapterIdentity.connectionId
      )
        throw Error('nodia_ai:invalid_terminal_proof');
    }
  } catch {
    throw Error('nodia_ai:invalid_terminal_proof');
  }
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
