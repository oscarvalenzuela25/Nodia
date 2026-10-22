import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ValidateNodiaAiRuntimePolicyUseCase } from './validate-nodia-ai-runtime-policy.use-case.js';
import { policyEnvelope } from './runtime.fixture.js';

describe('ValidateNodiaAiRuntimePolicyUseCase', () => {
  it('loads a deep immutable policy from the exact versioned asset', () => {
    const result = new ValidateNodiaAiRuntimePolicyUseCase().execute(
      policyEnvelope(),
    );
    expect(result.policyVersion).toBe('nodia-ai-runtime/1');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.retry.pre_dispatch_delay_seconds)).toBe(true);
  });
  it.each([undefined, null, [], {}, '{}', 42])(
    'rejects missing and malformed policy envelopes %j',
    (input) => {
      expect(() =>
        new ValidateNodiaAiRuntimePolicyUseCase().execute(input),
      ).toThrow('policy_unavailable');
    },
  );
  it('rejects content corruption before interpreting the schema', () => {
    const asset = policyEnvelope();
    asset.contentHash = 'a'.repeat(64);
    expect(() =>
      new ValidateNodiaAiRuntimePolicyUseCase().execute(asset),
    ).toThrow('policy_unavailable');
  });
  it('rejects unknown envelope extensions', () => {
    expect(() =>
      new ValidateNodiaAiRuntimePolicyUseCase().execute({
        ...policyEnvelope(),
        fallback: 'invented',
      }),
    ).toThrow('policy_unavailable');
  });
  it('enforces cross-field heartbeat safety even after a coherent package hash is rebuilt', () => {
    const asset = policyEnvelope();
    const policy = asset.policy as {
      timing: { heartbeat_seconds: number; lease_seconds: number };
    };
    policy.timing.heartbeat_seconds = policy.timing.lease_seconds;
    const { contentHash: _hash, ...payload } = asset;
    asset.contentHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    expect(() =>
      new ValidateNodiaAiRuntimePolicyUseCase().execute(asset),
    ).toThrow('policy_unavailable');
  });
});
