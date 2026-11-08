import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiAdapterTransport } from '../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { GeminiTeacherTextTransport } from './gemini-teacher-text-transport.js';
import {
  TEACHER_AGENTIC_CONTRACT, TeacherAgenticClosedError, agenticTextHash, teacherAgenticReference,
  type TeacherAgenticCommand, type TeacherAgenticProof,
} from './agentic-text-contract.js';

const command: TeacherAgenticCommand = { contract: TEACHER_AGENTIC_CONTRACT,
  operation_id: '11111111-1111-4111-8111-111111111111', session_id: '22222222-2222-4222-8222-222222222222',
  job_id: '33333333-3333-4333-8333-333333333333', attempt_id: '44444444-4444-4444-8444-444444444444',
  actor_id: '1', connection_id: '4', model_id: 'synthetic-model', effort_id: null,
  resource_key: 'gemini-profile:' + 'a'.repeat(64), configuration_generation: 'b'.repeat(64),
  session_generation: 'c'.repeat(32), runtime_hash: 'd'.repeat(64), policy_hash: 'e'.repeat(64),
  request_hash: 'f'.repeat(64), prompt: 'Synthetic private prompt', deadline_at: '2026-11-01T20:00:00Z' };
const reference = teacherAgenticReference(command);
const proof: TeacherAgenticProof = { ...reference, terminal_proof_id: '55555555-5555-4555-8555-555555555555',
  process_closed: true, remote_outcome: 'completed', response_hash: agenticTextHash('Synthetic'), observed_at: '2026-11-01T19:00:00Z' };
function fixture() {
  const request = vi.fn<(path: string, payload: object, signal: AbortSignal, dispatch?: boolean,
    rejected?: (body: unknown, status: number) => void) => Promise<unknown>>();
  return { request, transport: new GeminiTeacherTextTransport({ request } as unknown as NodiaAiAdapterTransport) };
}
function exclusion() {
  return { code: 'runtime_busy', detail: 'Synthetic private rejection', dispatch_exclusion_proof: {
    contract: TEACHER_AGENTIC_CONTRACT, operation_id: command.operation_id, request_hash: command.request_hash,
    session_generation: command.session_generation, runtime_hash: command.runtime_hash,
    process_started: false, provider_started: false, dispatch_exclusion: true, observed_at: '2026-11-01T19:00:00Z' } };
}

describe('Gemini private Teacher protocol boundary', () => {
  it('only an exact bounded pre-dispatch exclusion can prove start did not happen', async () => {
    const f = fixture();
    f.request.mockImplementationOnce(async (_path, _body, _signal, _dispatch, rejected) => {
      rejected?.(exclusion(), 409); throw Error('synthetic HTTP rejection');
    });
    const error = await f.transport.start(command, new AbortController().signal).catch(e => e);
    expect(error).toBeInstanceOf(TeacherAgenticClosedError);
    expect(error.notStarted).toBe(true);
    expect(error.descriptor.reference).toEqual(reference);
    expect(f.request).toHaveBeenCalledOnce();
  });

  it('HTTP code, a lost reader or a proof for another request never certify native closure', async () => {
    for (const variant of ['missing', 'other_hash', 'other_operation', 'started', 'extra', 'server_error']) {
      const f = fixture(), body = exclusion();
      if (variant === 'other_hash') body.dispatch_exclusion_proof.request_hash = '0'.repeat(64);
      if (variant === 'other_operation') body.dispatch_exclusion_proof.operation_id = command.session_id;
      if (variant === 'started') Object.assign(body.dispatch_exclusion_proof, { process_started: true });
      if (variant === 'extra') Object.assign(body.dispatch_exclusion_proof, { text: 'forbidden extra' });
      f.request.mockImplementationOnce(async (_path, _body, _signal, _dispatch, rejected) => {
        if (variant !== 'missing') rejected?.(body, variant === 'server_error' ? 503 : 409);
        throw Error('synthetic HTTP reader ended');
      });
      const error = await f.transport.start(command, new AbortController().signal).catch(e => e);
      expect(error).not.toBeInstanceOf(TeacherAgenticClosedError);
    }
  });

  it('validates exact native ACK and rejects scope mutation before sending', async () => {
    const f = fixture();
    await expect(f.transport.acknowledge(reference, { ...proof, attempt_id: command.job_id }, new AbortController().signal)).rejects.toThrow();
    expect(f.request).not.toHaveBeenCalled();
    for (const body of [{}, { acknowledged: false }, { acknowledged: true, text: 'unexpected' }]) {
      f.request.mockResolvedValueOnce(body);
      await expect(f.transport.acknowledge(reference, proof, new AbortController().signal)).rejects.toThrow('ack_unproven');
    }
    f.request.mockResolvedValueOnce({ acknowledged: true });
    await f.transport.acknowledge(reference, proof, new AbortController().signal);
    expect(f.request.mock.calls.at(-1)?.[1]).toEqual({ ...reference, terminal_proof_id: proof.terminal_proof_id, response_hash: proof.response_hash });
  });
});
