import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportCvOutputRejection } from './nodia-cv-generation-errors.js';

const context = {
  row: {
    id: '93ec0c86-bef1-499e-9a6f-248189daf472',
    offer_text: 'private offer',
  },
  configuration: {
    providerKey: 'openai' as const,
    sessionGeneration: 'private session',
  },
  selection: { mode: 'agentic' as const, model_id: 'private model' },
};

describe('CV output rejection diagnostics', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits only the bounded reason and correlation fields', () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    reportCvOutputRejection(context, 'invalid_citation');
    reportCvOutputRejection(context, 'private provider response');
    reportCvOutputRejection(context, 'codex_outcome_unknown');

    expect(warn.mock.calls).toEqual([
      [
        {
          event: 'cv_generated_output_rejected',
          generation_id: context.row.id,
          provider: 'openai',
          mode: 'agentic',
          reason: 'invalid_citation',
        },
      ],
    ]);
  });

  it('does not let a diagnostic sink failure interrupt closure', () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      throw new Error('unavailable log sink');
    });
    expect(() =>
      reportCvOutputRejection(context, 'invalid_evidence'),
    ).not.toThrow();
  });
});
