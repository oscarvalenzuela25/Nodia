import { describe, expect, it } from 'vitest';
import { agenticHash, TEACHER_AGENTIC_CONTRACT, type TeacherAgenticReference } from '../../../ai-generation/agentic-text-contract.js';
import { decodeCodexTeacherEntry, type CodexTeacherRecord } from './codex-teacher-journal.js';

const reference: TeacherAgenticReference = { contract: TEACHER_AGENTIC_CONTRACT,
  operation_id: '11111111-1111-4111-8111-111111111111', session_id: '22222222-2222-4222-8222-222222222222',
  job_id: '33333333-3333-4333-8333-333333333333', attempt_id: '44444444-4444-4444-8444-444444444444', actor_id: '1', connection_id: '4',
  model_id: 'synthetic-model', effort_id: null, resource_key: 'codex-profile:' + 'a'.repeat(64), configuration_generation: 'b'.repeat(64),
  session_generation: 'c'.repeat(32), runtime_hash: 'd'.repeat(64), policy_hash: 'e'.repeat(64), request_hash: 'f'.repeat(64) };
function fixture(): CodexTeacherRecord {
  return { version: 1, kind: 'active', reference, owner: { pid: 1001, group: 1000, birth: '100', boot: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    native: { pid: 2001, group: 2001, birth: '200', boot: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, workspace: 'teacher-work-synthetic',
    binding_hash: '0'.repeat(64), proof_nonce: null, state: 'armed', proof: null };
}
describe('neutral Codex Teacher crash journal contracts', () => {
  it('retains Teacher owner/input/process certificates and never accepts chat aliases, prompts or reply fields', () => {
    expect(decodeCodexTeacherEntry(fixture())).toEqual(fixture());
    for (const key of ['chat_id', 'conversation_id', 'prompt', 'text', 'auth'])
      expect(() => decodeCodexTeacherEntry({ ...fixture(), [key]: 'forbidden synthetic extra' })).toThrow();
    expect(() => decodeCodexTeacherEntry({ ...fixture(), reference: { ...reference, conversation_id: reference.session_id } })).toThrow();
  });
  it('rejects closure without an exact group certificate or with a mismatched terminal proof', () => {
    expect(() => decodeCodexTeacherEntry({ ...fixture(), native: { ...fixture().native, group: 2002 } })).toThrow();
    expect(() => decodeCodexTeacherEntry({ ...fixture(), native: null, state: 'closed' })).toThrow();
    expect(() => decodeCodexTeacherEntry({ ...fixture(), state: 'closed', proof: { ...reference,
      actor_id: '2', terminal_proof_id: '55555555-5555-4555-8555-555555555555', process_closed: true,
      remote_outcome: 'unknown', response_hash: null, observed_at: '2026-11-01T20:00:00Z' } })).toThrow();
    expect(() => decodeCodexTeacherEntry({ ...fixture(), workspace: '../private-profile' })).toThrow();
  });
  it('redacts acknowledged content into stable no-replay hashes, retaining cleanup certificates only while necessary', () => {
    const minimal = { version: 1, kind: 'ack', operation_id: reference.operation_id, reference_hash: agenticHash(reference), ack_hash: '0'.repeat(64), release: null };
    expect(decodeCodexTeacherEntry(minimal)).toEqual(minimal);
    expect(() => decodeCodexTeacherEntry({ ...minimal, proof: {} })).toThrow();
    expect(() => decodeCodexTeacherEntry({ ...minimal, release: { owner: fixture().owner, native: fixture().native,
      connection_id: '4', workspace: '/arbitrary/path' } })).toThrow();
  });
});
