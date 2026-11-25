import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createCvCodexHostWire,
  CV_CODEX_HOST_MAX_TERMINAL_FRAME_BYTES,
  type CvCodexHostRequest,
} from './nodia-cv-codex-wire.js';

const policyHash = 'a'.repeat(64);
const sourceCommit = 'b'.repeat(40);
const operationId = '79f94bed-528f-4bc9-8ac4-b401ff7dc0c1';
const nonce = '04ad5853-6967-403e-ab11-b39a4c229ec1';
const hash = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');
const protocolError = 'cv:codex_host_protocol_invalid';

function fixture() {
  const request: CvCodexHostRequest = {
    operation_id: operationId,
    model_id: 'fixture-text-model',
    effort_id: 'high',
    prompt: 'Fixture mínima',
    deadline_at: new Date(Date.now() + 30_000).toISOString(),
    configuration_generation: 'fixture-config',
    session_generation: 'fixture-session',
    resource_key: 'fixture-resource',
  };
  // Independent Rust binding fixture. serde_json serializes these keys lexically.
  const bindingHash = hash(
    JSON.stringify({
      configuration_generation: request.configuration_generation,
      deadline_at: request.deadline_at,
      effort_id: request.effort_id,
      model_id: request.model_id,
      operation_id: request.operation_id,
      policy_hash: policyHash,
      prompt_hash: hash(request.prompt),
      resource_key: request.resource_key,
      session_generation: request.session_generation,
      source_commit: sourceCommit,
    }),
  );
  const started = {
    event: 'started',
    operation_id: operationId,
    binding_hash: bindingHash,
    proof_nonce: nonce,
    policy_hash: policyHash,
  };
  const text = '{"requirements":[],"selectedEvidenceIds":["e1"]}';
  const completed = {
    event: 'terminal',
    status: 'completed',
    binding_hash: bindingHash,
    proof_nonce: nonce,
    text_hash: hash(text),
    text,
    local_closed: true,
    remote_outcome: 'completed',
  };
  return {
    request,
    started,
    completed,
    wire: createCvCodexHostWire(request, policyHash, sourceCommit),
  };
}

function preDispatchError() {
  return {
    event: 'terminal',
    status: 'error',
    code: 'invalid_configuration',
    binding_hash: null,
    local_closed: true,
    remote_outcome: 'not_dispatched',
    retry: false,
  };
}

describe('CV restricted Codex wire', () => {
  it('encodes the exact request and accepts one bound terminal result', () => {
    const { request, started, completed, wire } = fixture();
    expect(wire.input.endsWith('\n')).toBe(true);
    expect(JSON.parse(wire.input)).toEqual(request);
    expect(wire.accept(JSON.stringify(started))).toBe(false);
    expect(wire.accept(JSON.stringify(completed))).toBe(true);
    expect(wire.finish()).toEqual({
      outcome: 'completed',
      text: completed.text,
    });
  });

  it('preserves an explicit null effort', () => {
    const { request } = fixture();
    const wire = createCvCodexHostWire(
      { ...request, effort_id: null },
      policyHash,
      sourceCommit,
    );
    expect(JSON.parse(wire.input)).toMatchObject({ effort_id: null });
  });

  it.each([
    'model_id',
    'effort_id',
    'operation_id',
    'session_generation',
    'resource_key',
    'prompt',
  ] as const)('rejects a started receipt bound to a different %s', (field) => {
    const { request, started } = fixture();
    const substituted = field === 'operation_id' ? nonce : 'substituted';
    const wire = createCvCodexHostWire(
      { ...request, [field]: substituted },
      policyHash,
      sourceCommit,
    );
    expect(() => wire.accept(JSON.stringify(started))).toThrow(protocolError);
    expect(() => wire.finish()).toThrow(protocolError);
  });

  it('enforces the native byte ceiling before building the request', () => {
    const { request } = fixture();
    const prompt = 'é'.repeat(65_536);
    expect(() =>
      createCvCodexHostWire({ ...request, prompt }, policyHash, sourceCommit),
    ).not.toThrow();
    expect(() =>
      createCvCodexHostWire(
        { ...request, prompt: prompt + 'x' },
        policyHash,
        sourceCommit,
      ),
    ).toThrow(protocolError);
  });

  it('rejects an expired deadline or fields outside the host protocol', () => {
    const { request } = fixture();
    expect(() =>
      createCvCodexHostWire(
        { ...request, deadline_at: new Date(Date.now() - 1).toISOString() },
        policyHash,
        sourceCommit,
      ),
    ).toThrow(protocolError);
    const withTools = { ...request, tools: [] };
    expect(() =>
      createCvCodexHostWire(withTools, policyHash, sourceCommit),
    ).toThrow(protocolError);
  });

  it.each([
    { proof_nonce: operationId },
    { text_hash: policyHash },
    { local_closed: false },
    { tool_calls: [] },
    { text: '\ud800', text_hash: hash('\ud800') },
    { text: 'é'.repeat(16_385), text_hash: hash('é'.repeat(16_385)) },
  ])('rejects a terminal frame with an invalid field', (substituted) => {
    const { started, completed, wire } = fixture();
    wire.accept(JSON.stringify(started));
    expect(() =>
      wire.accept(JSON.stringify({ ...completed, ...substituted })),
    ).toThrow(protocolError);
    expect(() => wire.finish()).toThrow(protocolError);
  });

  it('requires one start and terminal and bounds the frame before parsing', () => {
    const { started, completed, wire } = fixture();
    expect(() => wire.finish()).toThrow(protocolError);
    expect(() => wire.accept(JSON.stringify(completed))).toThrow(protocolError);
    expect(() => wire.accept(JSON.stringify(started))).toThrow(protocolError);

    const oversized = fixture().wire;
    expect(() =>
      oversized.accept(
        ' '.repeat(CV_CODEX_HOST_MAX_TERMINAL_FRAME_BYTES) + '{}',
      ),
    ).toThrow(protocolError);
    const duplicate = fixture().wire;
    expect(() =>
      duplicate.accept(
        JSON.stringify(started).replace(
          '{"event":',
          '{"event":"terminal","event":',
        ),
      ),
    ).toThrow(protocolError);

    const trailing = fixture();
    trailing.wire.accept(JSON.stringify(trailing.started));
    trailing.wire.accept(JSON.stringify(trailing.completed));
    expect(() =>
      trailing.wire.accept(JSON.stringify(trailing.completed)),
    ).toThrow(protocolError);
    expect(() => trailing.wire.finish()).toThrow(protocolError);
  });

  it('accepts an allowlisted pre-dispatch rejection and rejects unsupported evidence', () => {
    const { wire } = fixture();
    expect(wire.accept(JSON.stringify(preDispatchError()))).toBe(true);
    expect(wire.finish()).toEqual({ outcome: 'not_dispatched', text: null });
    expect(() =>
      fixture().wire.accept(
        JSON.stringify({
          ...preDispatchError(),
          code: 'provider_error',
        }),
      ),
    ).toThrow(protocolError);
    expect(() =>
      fixture().wire.accept(
        JSON.stringify({
          ...preDispatchError(),
          local_closed: false,
        }),
      ),
    ).toThrow(protocolError);
  });

  it('retains an armed failure as unknown irrespective of the host close flag', () => {
    for (const localClosed of [false, true]) {
      const { started, wire } = fixture();
      wire.accept(JSON.stringify(started));
      const terminal = {
        ...preDispatchError(),
        binding_hash: started.binding_hash,
        proof_nonce: started.proof_nonce,
        code: 'deadline_exceeded',
        local_closed: localClosed,
        remote_outcome: 'unknown',
      };
      expect(wire.accept(JSON.stringify(terminal))).toBe(true);
      expect(wire.finish()).toEqual({ outcome: 'unknown', text: null });
    }
  });
});
