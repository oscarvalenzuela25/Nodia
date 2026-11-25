import { describe, expect, it } from 'vitest';
import { agenticTextHash } from '../../ai-generation/agentic-text-contract.js';
import {
  CV_TAILORING_MAX_RESPONSE_BYTES,
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CV_TAILORING_SCHEMA_VERSION,
} from '../engine/types.js';
import {
  CV_AGENTIC_CONTRACT,
  CV_AGENTIC_POLICY_VERSION,
  cvAgenticPayloadHash,
  parseCvAgenticDescriptor,
  parseCvAgenticReceipt,
  type CvAgenticDescriptor,
  type CvAgenticReceipt,
} from './nodia-cv-agentic-contract.js';

const syntheticPayload = {
  systemPrompt: 'Return structured references.',
  userPrompt: '{"offer":"TypeScript experience","evidence":[]}',
};

const descriptor: CvAgenticDescriptor = {
  contract: CV_AGENTIC_CONTRACT,
  owner_kind: 'cv',
  provider: 'openai',
  mode: 'agentic',
  generation_id: 'a51dcc53-1a8e-4000-9000-7c24acdebac1',
  attempt_id: 'a51dcc53-1a8e-4000-9000-7c24acdebac2',
  profile_id: 'a51dcc53-1a8e-4000-9000-7c24acdebac3',
  profile_revision: 4,
  actor_id: '15',
  payload_hash: cvAgenticPayloadHash(syntheticPayload),
  resource_key: 'codex-profile:' + 'a'.repeat(64),
  configuration_generation: 'b'.repeat(64),
  session_generation: 'c'.repeat(32),
  connection_id: '21',
  model_id: 'synthetic-model',
  effort_id: 'high',
  purpose_version: CV_TAILORING_PURPOSE,
  prompt_version: CV_TAILORING_PROMPT_VERSION,
  schema_version: CV_TAILORING_SCHEMA_VERSION,
  policy_version: CV_AGENTIC_POLICY_VERSION,
  policy_hash: 'd'.repeat(64),
  runtime_hash: 'e'.repeat(64),
};

const output = '{"requirements":[],"selectedEvidenceIds":["e1"]}';
const receipt: CvAgenticReceipt = {
  ...descriptor,
  terminal_proof_id: 'a51dcc53-1a8e-4000-9000-7c24acdebac4',
  process_closed: true,
  observed_at: '2026-11-25T18:00:00.000Z',
  remote_outcome: 'completed',
  response_hash: agenticTextHash(output),
};

describe('CV Agentic identity contract', () => {
  it('takes an immutable snapshot of an exact descriptor and preserves explicit null effort', () => {
    const caller = { ...descriptor, effort_id: null, profile_revision: 5 };
    const parsed = parseCvAgenticDescriptor(caller);
    caller.profile_revision += 1;
    expect(parsed).toEqual({
      ...descriptor,
      effort_id: null,
      profile_revision: 5,
    });
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it('binds the exact two minimized prompt strings and ignores server-only metadata', () => {
    const reordered = {
      userPrompt: syntheticPayload.userPrompt,
      systemPrompt: syntheticPayload.systemPrompt,
      normalizedOffer: 'server-only data',
    };
    expect(cvAgenticPayloadHash(reordered)).toBe(descriptor.payload_hash);
    expect(
      cvAgenticPayloadHash({ ...syntheticPayload, systemPrompt: 'Changed' }),
    ).not.toBe(descriptor.payload_hash);
    expect(
      cvAgenticPayloadHash({ ...syntheticPayload, userPrompt: '{}' }),
    ).not.toBe(descriptor.payload_hash);
  });

  it.each([
    { provider: 'gemini' },
    { mode: 'api_key' },
    { contract: 'teacher-agentic-text/1' },
    { profile_revision: 2147483648 },
    { actor_id: '9223372036854775808' },
    { connection_id: '021' },
    { model_id: ' synthetic-model' },
    { effort_id: 'alt\no' },
    { resource_key: 'gemini-profile:' + 'a'.repeat(64) },
    { payload_hash: 'not-a-sha256' },
    { schema_version: 2 },
    { user_prompt: syntheticPayload.userPrompt },
  ])('rejects invalid descriptor fields %j', (changed) => {
    expect(() =>
      parseCvAgenticDescriptor({ ...descriptor, ...changed }),
    ).toThrow('nodiaCv:agentic_protocol_invalid');
  });

  it('requires own, enumerable data fields', () => {
    const value = {
      ...descriptor,
      get actor_id() {
        throw new Error('getter must not be read');
      },
    };
    expect(() => parseCvAgenticDescriptor(value)).toThrow(
      'nodiaCv:agentic_protocol_invalid',
    );
  });
});

describe('CV Agentic terminal receipt', () => {
  it('verifies the delivered bytes and allows recovery of metadata alone', () => {
    expect(parseCvAgenticReceipt(receipt, descriptor, output)).toEqual(receipt);
    expect(parseCvAgenticReceipt(receipt, descriptor)).toEqual(receipt);
    expect(() =>
      parseCvAgenticReceipt(receipt, descriptor, output + ' '),
    ).toThrow('nodiaCv:agentic_protocol_invalid');
  });

  it.each([
    { owner_kind: 'teacher' },
    { generation_id: '90b73a18-8507-435c-9b05-8c981c0674b0' },
    { attempt_id: '90b73a18-8507-435c-9b05-8c981c0674b1' },
    { actor_id: '16' },
    { profile_id: '90b73a18-8507-435c-9b05-8c981c0674b3' },
    { profile_revision: 5 },
    { payload_hash: '0'.repeat(64) },
    { connection_id: '22' },
    { configuration_generation: '0'.repeat(64) },
    { session_generation: '0'.repeat(32) },
    { resource_key: 'codex-profile:' + '0'.repeat(64) },
    { model_id: 'different-model' },
    { effort_id: 'low' },
    { policy_hash: '0'.repeat(64) },
    { runtime_hash: '0'.repeat(64) },
  ])('rejects a receipt attached to a different identity %j', (changed) => {
    expect(() =>
      parseCvAgenticReceipt({ ...receipt, ...changed }, descriptor),
    ).toThrow('nodiaCv:agentic_protocol_invalid');
  });

  it.each(['unknown', 'not_dispatched'] as const)(
    'requires proven local closure and an empty response for %s',
    (outcome) => {
      const closed = {
        ...receipt,
        remote_outcome: outcome,
        response_hash: null,
      };
      expect(parseCvAgenticReceipt(closed, descriptor)).toEqual(closed);
      expect(() =>
        parseCvAgenticReceipt({ ...closed, process_closed: false }, descriptor),
      ).toThrow('nodiaCv:agentic_protocol_invalid');
      expect(() =>
        parseCvAgenticReceipt(
          { ...closed, response_hash: receipt.response_hash },
          descriptor,
        ),
      ).toThrow('nodiaCv:agentic_protocol_invalid');
      expect(() => parseCvAgenticReceipt(closed, descriptor, output)).toThrow(
        'nodiaCv:agentic_protocol_invalid',
      );
    },
  );

  it('enforces byte bounds and well-formed UTF-8 before consuming completed text', () => {
    const fits = 'á'.repeat(CV_TAILORING_MAX_RESPONSE_BYTES / 2);
    expect(
      parseCvAgenticReceipt(
        { ...receipt, response_hash: agenticTextHash(fits) },
        descriptor,
        fits,
      ),
    ).toMatchObject({ remote_outcome: 'completed' });
    for (const invalid of [fits + 'á', '   ', '\uD800']) {
      expect(() =>
        parseCvAgenticReceipt(
          { ...receipt, response_hash: agenticTextHash(invalid) },
          descriptor,
          invalid,
        ),
      ).toThrow('nodiaCv:agentic_protocol_invalid');
    }
  });
});
