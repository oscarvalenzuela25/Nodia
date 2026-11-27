import { describe, expect, it } from 'vitest';
import { cvGenerationDispatchSeconds } from './nodia-cv-generation-deadline.js';

const policy = {
  queue: { wait_seconds: 300 },
  timing: { provider_dispatch_seconds: 120, run_seconds: 600 },
};

describe('CV generation dispatch budget', () => {
  it('allows a longer Agentic generation within the full run and native budgets', () => {
    expect(cvGenerationDispatchSeconds('agentic', policy)).toBe(270);
  });

  it('caps Agentic dispatch when less time remains after the configured queue budget', () => {
    expect(
      cvGenerationDispatchSeconds('agentic', {
        ...policy,
        timing: { ...policy.timing, run_seconds: 500 },
      }),
    ).toBe(200);
  });

  it('preserves the shared dispatch budget for API key without changing the queue', () => {
    expect(cvGenerationDispatchSeconds('api_key', policy)).toBe(120);
  });
});
