import { describe, expect, it } from 'vitest';
import {
  CODEX_CV_HOST_CAPABILITIES,
  CodexCvHostSelectionError,
  selectCvCodexModelMetadata,
} from './nodia-cv-codex-host.js';

const wanted = { model_id: 'gpt-6.2-sol', effort_id: 'high' };
const model = {
  slug: wanted.model_id,
  supported_reasoning_levels: [{ effort: 'high' }, { effort: 'medium' }],
  model_messages: { instructions_template: 'Synthetic model metadata' },
};

describe('CV restricted host compatibility catalog', () => {
  it('extracts only the exact model with the requested effort and retains its SDK fields', () => {
    const catalog = {
      models: [{ ...model, slug: 'other-available-model' }, model],
    };
    expect(JSON.parse(selectCvCodexModelMetadata(catalog, wanted))).toEqual(
      model,
    );
  });

  it.each(['GPT-6.2-Sol', 'gpt-6.2-sol-latest', 'gpt-6.1-sol'])(
    'does not substitute %s for the exact selection',
    (slug) => {
      expect(() =>
        selectCvCodexModelMetadata({ models: [{ ...model, slug }] }, wanted),
      ).toThrow(new CodexCvHostSelectionError('codex_model_unavailable'));
    },
  );

  it('rejects an unavailable effort and preserves an explicit absent preference', () => {
    expect(() =>
      selectCvCodexModelMetadata(
        { models: [model] },
        { ...wanted, effort_id: 'low' },
      ),
    ).toThrow(new CodexCvHostSelectionError('codex_effort_unavailable'));
    expect(
      JSON.parse(
        selectCvCodexModelMetadata(
          { models: [model] },
          { ...wanted, effort_id: null },
        ),
      ),
    ).toEqual(model);
  });

  it('fails closed for duplicate model IDs or malformed SDK metadata', () => {
    for (const models of [
      [model, model],
      [{ ...model, supported_reasoning_levels: ['high'] }],
      [
        {
          ...model,
          model_messages: { instructions_template: 'x'.repeat(96_000) },
        },
      ],
    ]) {
      expect(() => selectCvCodexModelMetadata({ models }, wanted)).toThrow(
        'cv:codex_host_unverified',
      );
    }
  });

  it('exposes dedicated text-only capabilities for the CV artifact', () => {
    expect(CODEX_CV_HOST_CAPABILITIES).toMatchObject({
      protocol: 'nodia-cv-codex-host/1',
      purpose: 'cv-tailoring/1',
      tools: [],
      attachments: [],
      retries: 0,
    });
  });
});
