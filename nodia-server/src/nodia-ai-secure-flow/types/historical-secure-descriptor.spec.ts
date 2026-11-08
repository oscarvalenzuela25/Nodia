import { describe, it, expect } from 'vitest';
import {
  historicalSecureDescriptor,
  secureDescriptor,
} from './secure-flow.types.js';
const fixture = () => ({
  schema_version: 1,
  kind: 'secure_human_flow',
  reference: '11111111-1111-4111-8111-111111111111',
  flow_kind: 'connection_login',
  actor_id: '1',
  session_id: '22222222-2222-4222-8222-222222222222',
  expires_at: '2026-10-28T00:00:00.000Z',
  status: 'completed',
  request_id: '33333333-3333-4333-8333-333333333333',
  request_action: 'start',
  request_revision: 1,
  native_request: {
    request_id: '44444444-4444-4444-8444-444444444444',
    provider_id: '2',
    provider_key: 'gemini',
    mode: 'token_plan_web',
  },
  native_reference: {
    job_id: 'historical',
    provider_id: '2',
    provider_key: 'gemini',
    mode: 'token_plan_web',
  },
});
describe('immutable historical secure receipts', () => {
  it.each(['token_plan_web', 'token_plan_agentic'])(
    'projects %s only through the read parser without changing its bytes',
    (mode) => {
      const value = fixture();
      value.native_request.mode = mode;
      value.native_reference.mode = mode;
      const bytes = JSON.stringify(value);
      expect(historicalSecureDescriptor(value).native_request?.mode).toBe(
        'agentic',
      );
      expect(JSON.stringify(value)).toBe(bytes);
      expect(() => secureDescriptor(value)).toThrow('invalid_persisted_state');
    },
  );
  it('rejects divergent immutable native identities before normalization', () => {
    const value = fixture();
    value.native_reference.mode = 'token_plan_agentic';
    expect(() => historicalSecureDescriptor(value)).toThrow(
      'invalid_persisted_state',
    );
  });
  it('never accepts a Web mode for an OpenAI native witness', () => {
    const value = fixture();
    value.native_request.provider_key = 'openai';
    value.native_reference.provider_key = 'openai';
    expect(() => historicalSecureDescriptor(value)).toThrow(
      'invalid_persisted_state',
    );
  });
  it('does not normalize arbitrary retired or unknown strings', () => {
    const value = fixture();
    value.native_request.mode = 'retired';
    value.native_reference.mode = 'retired';
    expect(() => historicalSecureDescriptor(value)).toThrow(
      'invalid_persisted_state',
    );
  });
});
