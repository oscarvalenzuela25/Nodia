import { describe, expect, it } from 'vitest';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { NodiaAiKnownPreDispatchError } from './worker.types.js';
import { nodiaAiEligibilityDiagnostic, nodiaAiFailureDiagnostic, withNodiaAiEligibilityDiagnostic } from './nodia-ai-failure-diagnostic.js';

describe('nodiaAiFailureDiagnostic', () => {
  const eligibility = () => ({
    location: 'inference_observation_guard', reason: 'model_option_mismatch',
    source: 'gemini_live_session_and_catalog', adapter_contract: 'nodia-ai-gemini-chat/1', selection_phase: 'execution',
    available: false, delegated: false, resource_key_present: true, resource_key_matches: true,
    configuration_matches: true, session_matches: true, adapter_identity_matches: true, supports_mcp: false,
  });
  it('records the closed negative observation in the existing failure projection without changing the error or retryability', () => {
    const error = new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    expect(withNodiaAiEligibilityDiagnostic(error, eligibility)).toBe(error);
    expect(error.errorCode).toBe('nodia_ai:eligibility_changed');
    expect(error.retryable).toBe(false);
    expect(nodiaAiFailureDiagnostic(error)).toEqual({ error_type: 'NodiaAiKnownPreDispatchError',
      error_code: 'nodia_ai:eligibility_changed', sql_state: null, eligibility: eligibility() });
    expect(Object.isFrozen(nodiaAiFailureDiagnostic(error).eligibility)).toBe(true);
    expect(error).not.toHaveProperty('eligibility');
  });
  it('does not infer a sidecar for another barrier or trust an arbitrary property attached to an error', () => {
    const error = Object.assign(new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed'), { eligibility: eligibility() });
    expect(nodiaAiFailureDiagnostic(error)).not.toHaveProperty('eligibility');
    const different = withNodiaAiEligibilityDiagnostic(new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true), eligibility);
    expect(nodiaAiFailureDiagnostic(different)).not.toHaveProperty('eligibility');
    expect(different.retryable).toBe(true);
  });
  it.each(['SELECT private FROM secrets', '/private/profile/token', 'model_option_mismatch\nPRIVATE', '',
    { toString: () => { throw Error('PRIVATE'); } }, ['model_option_mismatch'], false, 0])(
    'redacts a reason outside the exact source-owned categories (%j)', (reason) => {
      const input = { ...eligibility(), reason, source: 'private_source', adapter_contract: '/private/path',
        selection_phase: 'private_phase', location: 'private_location', model_id: 'private_model',
        session_generation: 'private_session', resource_key: 'private_resource', message: 'private_payload',
        available: 'private_available', supports_mcp: 1 };
      const result = nodiaAiEligibilityDiagnostic(input);
      expect(result).toEqual({ ...eligibility(), location: 'other', reason: 'other', source: 'other',
        adapter_contract: 'other', selection_phase: 'other', available: null, supports_mcp: null });
      expect(JSON.stringify(result)).not.toContain('private');
      expect(JSON.stringify(result)).not.toContain('PRIVATE');
    },
  );
  it('preserves null reason and real false booleans without coercion', () => {
    const result = nodiaAiEligibilityDiagnostic({ ...eligibility(), reason: null, resource_key_matches: false,
      configuration_matches: false, session_matches: false, adapter_identity_matches: false });
    expect(result.reason).toBeNull();
    expect(result.available).toBe(false);
    expect(result.resource_key_matches).toBe(false);
    expect(result.configuration_matches).toBe(false);
    expect(result.session_matches).toBe(false);
    expect(result.adapter_identity_matches).toBe(false);
  });
  it('never invokes reason accessors or inherited input fields and redacts hostile proxies', () => {
    let accesses = 0;
    const input = Object.defineProperty(Object.create({ source: 'gemini_live_session_and_catalog' }), 'reason', {
      get: () => { accesses++; throw new Error('PRIVATE'); },
    });
    const result = nodiaAiEligibilityDiagnostic(input);
    expect(accesses).toBe(0);
    expect(result.reason).toBe('other');
    expect(result.source).toBe('other');
    const hostile = new Proxy({}, { getOwnPropertyDescriptor: () => { throw new Error('PRIVATE'); } });
    expect(() => nodiaAiEligibilityDiagnostic(hostile)).not.toThrow();
    expect(JSON.stringify(nodiaAiEligibilityDiagnostic(hostile))).not.toContain('PRIVATE');
  });
  it('keeps telemetry independent from mutable input and preserves the failure if preparing it throws', () => {
    const input = eligibility();
    const error = withNodiaAiEligibilityDiagnostic(new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed'), () => input);
    input.reason = 'PRIVATE';
    expect(nodiaAiFailureDiagnostic(error).eligibility?.reason).toBe('model_option_mismatch');
    const unannotated = new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    expect(withNodiaAiEligibilityDiagnostic(unannotated, () => { throw Error('PRIVATE'); })).toBe(unannotated);
    expect(nodiaAiFailureDiagnostic(unannotated)).not.toHaveProperty('eligibility');
  });
  it.each(['runtime_busy', 'adapter_invalid_observation', 'adapter_configuration_changed',
    'adapter_attachments_unverified', 'mcp_catalog_invalid', 'adapter_invalid_request'])('retains the closed adapter code %s', (code) => {
    expect(nodiaAiFailureDiagnostic(new NodiaAiAdapterError(code, 'not_dispatched'))).toEqual({
      error_type: 'NodiaAiAdapterError', error_code: code, sql_state: null,
    });
  });
  it('retains the durable predispatch retry category without provider content', () => {
    expect(nodiaAiFailureDiagnostic(new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true))).toEqual({
      error_type: 'NodiaAiKnownPreDispatchError', error_code: 'nodia_ai:runtime_busy', sql_state: null,
    });
  });
  it('redacts unknown codes, private messages, SQL and native paths', () => {
    const error = Object.assign(new NodiaAiAdapterError('private_transport_secret', 'unknown'), {
      message: 'SELECT secret FROM private; /private/profile/session',
      stack: 'private_prompt_and_bytes', driverError: { code: 'private_sql_secret' },
    });
    expect(nodiaAiFailureDiagnostic(error)).toEqual({ error_type: 'NodiaAiAdapterError', error_code: null, sql_state: null });
  });
  it('does not let a hostile getter replace the original failure', () => {
    const error = Object.defineProperty({}, 'constructor', { get: () => { throw new Error('private_secret'); } });
    expect(nodiaAiFailureDiagnostic(error)).toEqual({ error_type: 'Other', error_code: null, sql_state: null });
  });
});
