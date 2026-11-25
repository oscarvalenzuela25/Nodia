import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  agenticHash,
  agenticTextHash,
} from '../../ai-generation/agentic-text-contract.js';
import type { NodiaAiAdapterTransport } from '../../nodia-ai-adapter/nodia-ai-adapter.service.js';
import { prepareCvTailoring } from '../engine/index.js';
import { readNodiaCvProfile } from '../policies/nodia-cv-profile.js';
import {
  CV_AGENTIC_CONTRACT,
  cvAgenticPayloadHash,
} from './nodia-cv-agentic-contract.js';
import { parseCvGeminiDescriptor } from './nodia-cv-agentic-provider.js';
import {
  NodiaCvGeminiTransport,
  type CvGeminiCommand,
} from './nodia-cv-gemini-transport.js';

const signal = new AbortController().signal;
const deadline = new Date('2026-11-25T19:12:30.000Z');
const observed = '2026-11-25T19:12:00.123456+00:00';
const { profile } = readNodiaCvProfile({
  profile_name: 'Profile',
  full_name: 'Synthetic Applicant',
  contact: { email: 'fixture@example.invalid' },
  main_stack: ['TypeScript'],
});
const { data, ...header } = profile;
const prepared = prepareCvTailoring({
  profile: {
    ...header,
    ...data,
    id: randomUUID(),
    revision: 1,
    created_at: deadline,
    updated_at: deadline,
  },
  offer: 'Required: TypeScript. Preferred: Kubernetes.',
  locale: 'en',
});
const descriptor = parseCvGeminiDescriptor({
  contract: CV_AGENTIC_CONTRACT,
  owner_kind: 'cv',
  provider: 'gemini',
  mode: 'agentic',
  generation_id: randomUUID(),
  attempt_id: randomUUID(),
  actor_id: '17',
  profile_id: randomUUID(),
  profile_revision: 2,
  payload_hash: cvAgenticPayloadHash(prepared),
  resource_key: 'gemini-profile:' + 'a'.repeat(64),
  configuration_generation: 'b'.repeat(64),
  session_generation: 'c'.repeat(32),
  connection_id: '23',
  model_id: 'fixture-option-high',
  effort_id: 'high',
  purpose_version: 'cv_tailoring',
  prompt_version: 'cv-tailoring/1',
  schema_version: 1,
  policy_version: 'cv-agentic-text-policy/1',
  policy_hash: 'd'.repeat(64),
  runtime_hash: 'e'.repeat(64),
});

function setup() {
  const request = vi.fn<NodiaAiAdapterTransport['request']>();
  const transport = new NodiaCvGeminiTransport({ request });
  return {
    request,
    transport,
    command: transport.prepare(descriptor, prepared, deadline),
  };
}

function nativeCompletion(command: CvGeminiCommand, text: string | null) {
  const { prompt: _prompt, deadline_at: _deadline, ...reference } = command;
  return {
    contract: CV_AGENTIC_CONTRACT,
    operation_id: command.operation_id,
    state: 'completed',
    text,
    terminal_proof: {
      ...reference,
      terminal_proof_id: randomUUID(),
      observed_at: observed,
      process_closed: true,
      remote_outcome: 'completed',
      response_hash: agenticTextHash('the draft'),
    },
  };
}

describe('CV Gemini custody transport', () => {
  it('binds the profile revision, exact option and full prompt to the single native command', async () => {
    const { request, transport, command } = setup();
    const { request_hash, ...body } = command;
    expect(body.owner_digest).toBe(agenticHash(descriptor));
    expect(request_hash).toBe(agenticHash(body));
    expect(() =>
      transport.prepare(
        { ...descriptor, payload_hash: '0'.repeat(64) },
        prepared,
        deadline,
      ),
    ).toThrow();
    await expect(
      transport.start({ ...command, effort_id: 'low' }, descriptor, signal),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(nativeCompletion(command, 'the draft'));
    await expect(
      transport.start(command, descriptor, signal),
    ).resolves.toMatchObject({
      state: 'terminal',
      text: 'the draft',
      receipt: {
        generation_id: descriptor.generation_id,
        observed_at: '2026-11-25T19:12:00.123Z',
      },
    });
    expect(request).toHaveBeenCalledExactlyOnceWith(
      '/cv/agentic-text/start',
      command,
      signal,
      true,
      expect.any(Function),
    );
  });

  it('rejects another purpose, mismatched closure and unproven status', async () => {
    const { request, transport, command } = setup();
    const valid = nativeCompletion(command, 'the draft');
    const bad = [
      { ...valid, contract: 'teacher-agentic-text/1' },
      { ...valid, text: 'tampered response' },
      {
        ...valid,
        terminal_proof: {
          ...valid.terminal_proof,
          owner_digest: 'f'.repeat(64),
        },
      },
      { ...valid, state: 'unknown', text: null, terminal_proof: null },
    ];
    for (const response of bad) {
      request.mockResolvedValueOnce(response);
      await expect(
        transport.status(descriptor, command.request_hash, signal),
      ).rejects.toThrow();
    }
    request.mockResolvedValueOnce(nativeCompletion(command, null));
    await expect(
      transport.reconcile(descriptor, command.request_hash, signal),
    ).resolves.toMatchObject({
      state: 'terminal',
      text: null,
      receipt: { remote_outcome: 'completed' },
    });
  });

  it('proves no dispatch only from an exact native exclusion, never from unavailability alone', async () => {
    const { request, transport, command } = setup();
    const proof = {
      contract: CV_AGENTIC_CONTRACT,
      observed_at: observed,
      operation_id: command.operation_id,
      request_hash: command.request_hash,
      session_generation: command.session_generation,
      runtime_hash: command.runtime_hash,
      process_started: false,
      provider_started: false,
      dispatch_exclusion: true,
    };
    const reject = (body: unknown, status: number) => {
      request.mockImplementationOnce(
        async (_route, _input, _signal, _dispatch, onRejected) => {
          onRejected?.(body, status);
          throw new Error('native unavailable');
        },
      );
    };
    reject({ code: 'runtime_busy', detail: 'busy' }, 409);
    await expect(transport.start(command, descriptor, signal)).rejects.toThrow(
      'native unavailable',
    );
    reject(
      {
        code: 'runtime_busy',
        detail: 'busy',
        dispatch_exclusion_proof: { ...proof, request_hash: 'f'.repeat(64) },
      },
      409,
    );
    await expect(transport.start(command, descriptor, signal)).rejects.toThrow(
      'native unavailable',
    );
    reject(
      { code: 'runtime_busy', detail: 'busy', dispatch_exclusion_proof: proof },
      409,
    );
    await expect(
      transport.start(command, descriptor, signal),
    ).resolves.toMatchObject({
      state: 'terminal',
      text: null,
      receipt: { remote_outcome: 'not_dispatched' },
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('acknowledges the exact terminal and rejects partial native acknowledgement', async () => {
    const { request, transport, command } = setup();
    request.mockResolvedValueOnce(nativeCompletion(command, null));
    const snapshot = await transport.status(
      descriptor,
      command.request_hash,
      signal,
    );
    if (snapshot.state !== 'terminal')
      throw new Error('missing fixture terminal');
    request.mockResolvedValueOnce({ acknowledged: true, extra: false });
    await expect(
      transport.acknowledge(
        descriptor,
        command.request_hash,
        snapshot.receipt,
        signal,
      ),
    ).rejects.toThrow();
    request.mockResolvedValueOnce({ acknowledged: true });
    await expect(
      transport.acknowledge(
        descriptor,
        command.request_hash,
        snapshot.receipt,
        signal,
      ),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenLastCalledWith(
      '/cv/agentic-text/ack',
      expect.objectContaining({
        request_hash: command.request_hash,
        owner_digest: agenticHash(descriptor),
        terminal_proof_id: snapshot.receipt.terminal_proof_id,
        response_hash: snapshot.receipt.response_hash,
      }),
      signal,
    );
  });
});
