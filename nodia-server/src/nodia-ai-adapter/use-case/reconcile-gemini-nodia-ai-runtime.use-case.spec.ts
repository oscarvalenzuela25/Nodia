import { describe, expect, it, vi } from 'vitest';
import { ReconcileGeminiNodiaAiRuntimeUseCase } from './reconcile-gemini-nodia-ai-runtime.use-case.js';
import type { NodiaAiAdapterTransport } from '../nodia-ai-adapter.service.js';
import type { NodiaAiRuntimeProofRequest } from '../../nodia-ai-runtime/types/reconciliation.types.js';
import { parseNativeTerminalProof } from '../native-terminal-proof.js';

const request: NodiaAiRuntimeProofRequest = {
  engine: 'agentic',
  attemptId: 'eadf13a7-4182-4793-b143-869529a38c49',
  resourceKey: 'gemini-profile:' + 'a'.repeat(64),
  sessionGeneration: 'b'.repeat(32),
  operationRef: 'eadf13a7-4182-4793-b143-869529a38c49',
};
function setup() {
  const value = {
    attempt_id: request.attemptId,
    resource_key: request.resourceKey,
    session_generation: request.sessionGeneration,
    operation_ref: request.operationRef,
    terminal_proof_id: '1797da24-fc13-4f29-a252-9562e071ca36',
    process_closed: true,
    outcome: 'completed',
    observed_at: new Date().toISOString(),
  };
  const transport = {
    request: vi.fn<NodiaAiAdapterTransport['request']>(
      async () => value as unknown,
    ),
  };
  return {
    value,
    transport,
    usecase: new ReconcileGeminiNodiaAiRuntimeUseCase(
      transport as unknown as NodiaAiAdapterTransport,
    ),
  };
}
describe('ReconcileGeminiNodiaAiRuntimeUseCase', () => {
  it('rejects a Codex identity before reconcile or ACK even when its prefix is forged as Gemini', async () => {
    const f = setup();
    const codex: NodiaAiRuntimeProofRequest = {
      ...request,
      engine: 'agentic',
      adapterIdentity: {
        providerKey: 'openai',
        contractVersion: 'nodia-ai-codex-chat/1',
        connectionId: '4',
      },
    };
    await expect(
      f.usecase.reconcile(codex, new AbortController().signal),
    ).rejects.toThrow('invalid_reconciliation');
    await expect(
      f.usecase.acknowledge(
        {
          ...codex,
          terminalProofId: f.value.terminal_proof_id,
          processClosed: true,
          outcome: 'completed',
          observedAt: new Date(),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('invalid_reconciliation');
    expect(f.transport.request).not.toHaveBeenCalled();
    expect(() => parseNativeTerminalProof(f.value, codex)).toThrow(
      'adapter_terminal_proof_invalid',
    );
  });
  it('accepts only a native terminal proof tied to the exact original attempt and profile', async () => {
    const f = setup();
    const result = await f.usecase.reconcile(
      request,
      new AbortController().signal,
    );
    expect(result.processClosed).toBe(true);
    expect(result.terminalProofId).toBe(f.value.terminal_proof_id);
    expect(Object.isFrozen(result)).toBe(true);
    expect(f.transport.request.mock.calls[0]?.[0]).toBe(
      `/nodia-ai/agentic/attempts/${request.attemptId}/reconcile`,
    );
  });
  it.each([
    'attempt_id',
    'resource_key',
    'session_generation',
    'operation_ref',
    'terminal_proof_id',
    'process_closed',
    'outcome',
    'observed_at',
    'extra',
  ])('rejects invalid or mismatched native proof %s', async (key) => {
    const f = setup();
    const value: Record<string, unknown> = { ...f.value };
    value[key] = key === 'process_closed' ? false : 'mismatch';
    f.transport.request.mockResolvedValueOnce(value);
    await expect(
      f.usecase.reconcile(request, new AbortController().signal),
    ).rejects.toThrow('invalid_terminal_proof');
  });
  it('never turns absent native proof into a successful reconciliation', async () => {
    const f = setup();
    f.transport.request.mockRejectedValueOnce(Error('proof_missing'));
    await expect(
      f.usecase.reconcile(request, new AbortController().signal),
    ).rejects.toThrow('proof_missing');
    expect(f.transport.request).toHaveBeenCalledTimes(1);
  });
  it('acknowledges a verified proof using its original identity without a generation request', async () => {
    const f = setup();
    const proof = await f.usecase.reconcile(
      request,
      new AbortController().signal,
    );
    f.transport.request.mockResolvedValueOnce({ acknowledged: true });
    await f.usecase.acknowledge(proof, new AbortController().signal);
    expect(f.transport.request.mock.calls[1]?.[0]).toBe(
      `/nodia-ai/agentic/attempts/${request.attemptId}/acknowledge`,
    );
  });
  it('retains a pending cleanup when native acknowledgement is malformed', async () => {
    const f = setup();
    const proof = await f.usecase.reconcile(
      request,
      new AbortController().signal,
    );
    f.transport.request.mockResolvedValueOnce({ acknowledged: false });
    await expect(
      f.usecase.acknowledge(proof, new AbortController().signal),
    ).rejects.toThrow('cleanup_pending');
  });
});
