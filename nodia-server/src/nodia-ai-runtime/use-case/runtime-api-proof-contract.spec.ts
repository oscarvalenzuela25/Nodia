import { describe, expect, it } from 'vitest';
import type {
  NodiaAiApiRuntimeProofRequest,
  NodiaAiApiRuntimeTerminalProof,
  NodiaAiRuntimeTerminalProof,
} from '../types/reconciliation.types.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
  readTerminalProof,
  runtimeProofDescriptor,
  terminalRuntimeProofDescriptor,
} from './runtime-reconciliation-descriptor.js';

function request(): NodiaAiApiRuntimeProofRequest {
  const attemptId = 'c59edbad-cd98-4830-b8bb-468d90600ad2';
  return {
    engine: 'api_key',
    attemptId,
    operationRef: attemptId,
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    adapterIdentity: {
      providerKey: 'openai',
      contractVersion: 'nodia-ai-api-chat/1',
      connectionId: '9007199254740993',
    },
  };
}
function proof(): NodiaAiApiRuntimeTerminalProof {
  return {
    ...request(),
    terminalProofId: 'f3ec5900-cd97-43d3-82df-5e71dc419f7d',
    observedAt: new Date('2026-10-27T20:00:00Z'),
    localTransportClosed: true,
    remoteOutcome: 'completed',
    outcome: 'completed',
  };
}

describe('API runtime proof schema3', () => {
  it.each(['openai', 'gemini'] as const)(
    'roundtrips exact %s identity without claiming native process closure',
    (providerKey) => {
      const original = {
        ...proof(),
        adapterIdentity: { ...request().adapterIdentity, providerKey },
      };
      const descriptor = terminalRuntimeProofDescriptor(original);
      expect(descriptor.schema_version).toBe(3);
      expect(descriptor.terminal_proof).toEqual({
        id: original.terminalProofId,
        outcome: 'completed',
        observed_at: original.observedAt.toISOString(),
        local_transport_closed: true,
        remote_outcome: 'completed',
      });
      const restored = readTerminalProof(
        JSON.parse(JSON.stringify(descriptor)),
      );
      expect(restored).toStrictEqual(original);
      expect(restored).not.toHaveProperty('processClosed');
      expect(() =>
        assertRuntimeTerminalProof(original, restored),
      ).not.toThrow();
    },
  );

  it('preserves remote uncertainty after proven local closure', () => {
    const original: NodiaAiApiRuntimeTerminalProof = {
      ...proof(),
      outcome: 'abandoned_unknown',
      remoteOutcome: 'unknown',
    };
    expect(
      readTerminalProof(terminalRuntimeProofDescriptor(original)),
    ).toStrictEqual(original);
    expect(() => assertRuntimeTerminalProof(request(), original)).not.toThrow();
  });

  it.each([
    ['engine', 'agentic'],
    ['provider_key', 'other'],
    ['provider_key', ['openai']],
    ['adapter_contract_version', 'nodia-ai-codex-chat/1'],
    ['resource_key', 'gemini-profile:' + 'a'.repeat(64)],
    ['resource_key', 'api-connection:' + 'A'.repeat(64)],
    ['connection_id', '04'],
    ['connection_id', '9223372036854775808'],
    ['session_generation', 'b'.repeat(31)],
    ['operation_ref', 'f3ec5900-cd97-43d3-82df-5e71dc419f7d'],
    ['attempt_id', 'not-uuid'],
    ['extra', true],
  ])('rejects malformed or cross-mode API discriminator %s', (key, value) => {
    const descriptor = runtimeProofDescriptor(request());
    Object.assign(descriptor.runtime as object, { [key]: value });
    expect(() => readRuntimeProofRequest(descriptor)).toThrow(
      'reconciliation_identity_missing',
    );
  });

  it.each([
    { local_transport_closed: false },
    { remote_outcome: 'unknown' },
    { process_closed: true },
    { remote_outcome: 'cancelled' },
    { outcome: 'abandoned_unknown', remote_outcome: ['unknown'] },
    { outcome: ['abandoned_unknown'], remote_outcome: 'unknown' },
    { outcome: 'abandoned_unknown' },
  ])('rejects false or contradictory wire closure %j', (mutation) => {
    const descriptor = terminalRuntimeProofDescriptor(proof());
    Object.assign(descriptor.terminal_proof as object, mutation);
    expect(() => readTerminalProof(descriptor)).toThrow(
      'invalid_terminal_proof',
    );
  });

  it.each([
    { localTransportClosed: false },
    { remoteOutcome: 'unknown' },
    { processClosed: true },
    { adapterIdentity: { ...request().adapterIdentity, connectionId: '7' } },
    {
      adapterIdentity: { ...request().adapterIdentity, providerKey: 'gemini' },
    },
  ])(
    'rejects forged in-memory proof before freeing its reservation %j',
    (mutation) => {
      expect(() =>
        assertRuntimeTerminalProof(request(), {
          ...proof(),
          ...mutation,
        } as unknown as NodiaAiRuntimeTerminalProof),
      ).toThrow('invalid_terminal_proof');
    },
  );

  it('does not let native schema2 or a missing own identity masquerade as API', () => {
    const descriptor = runtimeProofDescriptor(request());
    expect(() =>
      readRuntimeProofRequest({ ...descriptor, schema_version: 2 }),
    ).toThrow('reconciliation_identity_missing');
    const runtime = { ...(descriptor.runtime as Record<string, unknown>) };
    Reflect.deleteProperty(runtime, 'provider_key');
    Object.setPrototypeOf(runtime, { provider_key: 'openai' });
    runtime.extra = true;
    expect(() =>
      readRuntimeProofRequest({ schema_version: 3, runtime }),
    ).toThrow('reconciliation_identity_missing');
  });
});
