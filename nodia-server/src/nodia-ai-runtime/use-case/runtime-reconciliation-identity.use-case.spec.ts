import { describe, expect, it } from 'vitest';
import type {
  NodiaAiCodexRuntimeProofRequest,
  NodiaAiGeminiRuntimeProofRequest,
  NodiaAiRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../types/reconciliation.types.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
  readTerminalProof,
  runtimeProofDescriptor,
  terminalRuntimeProofDescriptor,
} from './runtime-reconciliation-descriptor.js';

const attemptId = 'a160f615-ea41-4a05-831d-acdbb413ec4d';
function gemini(): NodiaAiGeminiRuntimeProofRequest {
  return {
    engine: 'agentic',
    attemptId,
    operationRef: attemptId,
    resourceKey: 'gemini-profile:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
  };
}
function codex(): NodiaAiCodexRuntimeProofRequest {
  return {
    engine: 'agentic',
    attemptId,
    operationRef: attemptId,
    resourceKey: 'codex-profile:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    adapterIdentity: {
      providerKey: 'openai',
      contractVersion: 'nodia-ai-codex-chat/1',
      connectionId: '4',
    },
  };
}
function proof(
  request: NodiaAiRuntimeProofRequest = codex(),
): NodiaAiRuntimeTerminalProof {
  return {
    ...request,
    terminalProofId: '9196c349-9333-456c-99ea-3fd2a1c58325',
    processClosed: true,
    outcome: 'completed',
    observedAt: new Date('2026-10-22T20:00:00Z'),
  };
}
function wire() {
  return {
    schema_version: 2,
    runtime: {
      engine: 'agentic',
      attempt_id: attemptId,
      operation_ref: attemptId,
      resource_key: 'codex-profile:' + 'a'.repeat(64),
      session_generation: 'b'.repeat(32),
      provider_key: 'openai',
      adapter_contract_version: 'nodia-ai-codex-chat/1',
      connection_id: '4',
    },
  };
}

describe('NodiaAI recovery identity contracts', () => {
  it('rejects a forged Codex resource presented as two matching legacy requests', () => {
    const request = { ...gemini(), resourceKey: codex().resourceKey };
    expect(() => assertRuntimeTerminalProof(request, proof(request))).toThrow(
      'invalid_terminal_proof',
    );
  });

  it('rejects inherited discriminator fields hidden behind an unknown own field', () => {
    const runtime: Record<string, unknown> = { ...wire().runtime };
    Reflect.deleteProperty(runtime, 'provider_key');
    Object.setPrototypeOf(runtime, { provider_key: 'openai' });
    runtime.unexpected = true;
    expect(() =>
      readRuntimeProofRequest({ schema_version: 2, runtime }),
    ).toThrow('reconciliation_identity_missing');
  });
  it.each(['web', 'agentic'] as const)(
    'preserves historical Gemini schema 1 for %s',
    (engine) => {
      const request = { ...gemini(), engine };
      const descriptor = {
        schema_version: 1,
        runtime: {
          engine,
          attempt_id: attemptId,
          resource_key: request.resourceKey,
          session_generation: request.sessionGeneration,
          operation_ref: attemptId,
        },
      };
      expect(runtimeProofDescriptor(request)).toStrictEqual(descriptor);
      expect(readRuntimeProofRequest(descriptor)).toStrictEqual(request);
      const terminal = proof(request);
      const restored = readTerminalProof(
        terminalRuntimeProofDescriptor(terminal),
      );
      expect(restored).toStrictEqual(terminal);
      expect(() => assertRuntimeTerminalProof(request, restored)).not.toThrow();
    },
  );

  it('roundtrips the closed Codex identity and terminal receipt through JSON', () => {
    expect(runtimeProofDescriptor(codex())).toStrictEqual(wire());
    expect(
      readRuntimeProofRequest(JSON.parse(JSON.stringify(wire()))),
    ).toStrictEqual(codex());
    const terminal = proof();
    const restored = readTerminalProof(
      JSON.parse(JSON.stringify(terminalRuntimeProofDescriptor(terminal))),
    );
    expect(restored).toStrictEqual(terminal);
    expect(() => assertRuntimeTerminalProof(codex(), restored)).not.toThrow();
  });

  it.each(['1', '9007199254740993', '9223372036854775807'])(
    'preserves exact canonical connection %s',
    (connectionId) => {
      const descriptor = wire();
      descriptor.runtime.connection_id = connectionId;
      const restored = readRuntimeProofRequest(descriptor);
      expect(restored.adapterIdentity?.connectionId).toBe(connectionId);
    },
  );

  it.each([
    ['provider_key', 'gemini'],
    ['provider_key', 'openai-compatible'],
    ['adapter_contract_version', 'nodia-ai-gemini-chat/1'],
    ['adapter_contract_version', 'nodia-ai-codex-chat/2'],
    ['engine', 'web'],
    ['resource_key', 'gemini-profile:' + 'a'.repeat(64)],
    ['resource_key', 'arbitrary-profile:' + 'a'.repeat(64)],
    ['resource_key', 'codex-profile:' + 'A'.repeat(64)],
    ['session_generation', 'c'.repeat(31)],
    ['session_generation', null],
    ['connection_id', '0'],
    ['connection_id', '04'],
    ['connection_id', '+4'],
    ['connection_id', ' 4'],
    ['connection_id', '4 '],
    ['connection_id', 4],
    ['connection_id', '9223372036854775808'],
    ['connection_id', '1'.repeat(100)],
    ['attempt_id', 'not-a-uuid'],
    ['operation_ref', '9196c349-9333-456c-99ea-3fd2a1c58325'],
  ])('rejects mismatched or malformed Codex field %s=%s', (key, value) => {
    const descriptor = wire();
    Object.assign(descriptor.runtime, { [key]: value });
    expect(() => readRuntimeProofRequest(descriptor)).toThrow(
      'reconciliation_identity_missing',
    );
  });

  it.each(['provider_key', 'adapter_contract_version', 'connection_id'])(
    'rejects a missing Codex discriminator field %s',
    (key) => {
      const descriptor = wire();
      Reflect.deleteProperty(descriptor.runtime, key);
      expect(() => readRuntimeProofRequest(descriptor)).toThrow(
        'reconciliation_identity_missing',
      );
    },
  );

  it('does not relax Gemini v1 or permit a future/extra Codex runtime field', () => {
    const downgraded = { ...wire(), schema_version: 1 };
    expect(() => readRuntimeProofRequest(downgraded)).toThrow(
      'reconciliation_identity_missing',
    );
    const legacy = runtimeProofDescriptor(gemini());
    const malformed = {
      ...legacy,
      runtime: { ...wire().runtime, resource_key: gemini().resourceKey },
    };
    expect(() => readRuntimeProofRequest(malformed)).toThrow(
      'reconciliation_identity_missing',
    );
    expect(() =>
      readRuntimeProofRequest({
        ...wire(),
        runtime: { ...wire().runtime, secret: 'never accepted' },
      }),
    ).toThrow('reconciliation_identity_missing');
    expect(() =>
      readRuntimeProofRequest({ ...wire(), schema_version: 3 }),
    ).toThrow('reconciliation_identity_missing');
  });

  it('rejects cross-provider terminal proofs in both directions', () => {
    const codexProof = proof(),
      geminiProof = { ...proof(), ...gemini(), adapterIdentity: undefined };
    expect(() => assertRuntimeTerminalProof(codex(), geminiProof)).toThrow(
      'invalid_terminal_proof',
    );
    expect(() => assertRuntimeTerminalProof(gemini(), codexProof)).toThrow(
      'invalid_terminal_proof',
    );
  });

  it('rejects another connection even if all native fields are identical', () => {
    const other = proof();
    if (!other.adapterIdentity) throw Error('fixture identity required');
    other.adapterIdentity = { ...other.adapterIdentity, connectionId: '5' };
    expect(() => assertRuntimeTerminalProof(codex(), other)).toThrow(
      'invalid_terminal_proof',
    );
  });

  it.each([
    { resourceKey: 'codex-profile:' + 'c'.repeat(64) },
    { sessionGeneration: 'c'.repeat(32) },
    { engine: 'web' },
    { processClosed: false },
    { terminalProofId: 'invalid' },
    { observedAt: new Date(NaN) },
  ])('rejects mismatched terminal identity or closure %j', (change) => {
    const changed = Object.assign(proof(), change);
    expect(() => assertRuntimeTerminalProof(codex(), changed)).toThrow(
      'invalid_terminal_proof',
    );
  });

  it('fails closed before persisting invalid or extra adapter identity from an untyped caller', () => {
    const request = codex();
    Object.assign(request.adapterIdentity, { providerKey: 'gemini' });
    expect(() => runtimeProofDescriptor(request)).toThrow(
      'reconciliation_identity_missing',
    );
    const extended = codex();
    Object.assign(extended.adapterIdentity, { extra: true });
    expect(() => runtimeProofDescriptor(extended)).toThrow(
      'reconciliation_identity_missing',
    );
  });
});
