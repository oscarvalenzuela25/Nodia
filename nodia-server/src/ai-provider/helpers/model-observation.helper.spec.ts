import { describe, expect, it } from 'vitest';
import type { AiProvider } from '../entities/ai-provider.entity.js';
import { resolveAiProviderUpdate } from '../use-case/ai-provider-configuration.rules.js';
import { projectNodiaAiConnection } from '../../nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case.js';
import { configuredModelFields } from './model-observation.helper.js';

const firstModel = (fields: Record<string, unknown>) =>
  (fields.available_models as Record<string, unknown>[])[0];

describe('configured model selector metadata', () => {
  it('preserves dynamic effort choices through GET projection and a preference update without restoring observed capabilities', () => {
    const modelId = 'fixture-future-model';
    const fields = {
      agentic: {
        selected_model: modelId,
        thinking_level: 'future_balanced',
        quota: 100,
        available_models: [{
          id: modelId,
          name: 'Fixture future model',
          displayName: 'Fixture Future Model',
          supportedReasoningEfforts: ['future_balanced', 'future_deep'],
          description: 'Historical description',
          contextWindow: 12345,
          capabilities: ['vision', 'reasoning'],
          inputModalities: ['image'],
          rateLimits: { requestsPerMinute: 10 },
          isRecommended: true,
          secret: 'synthetic-never-public',
        }],
      },
    };
    const original = structuredClone(fields);
    const publicFields = configuredModelFields(fields);
    const publicMode = publicFields.agentic as Record<string, unknown>;
    const publicModel = firstModel(publicMode);
    expect(publicModel).toEqual({
      id: modelId, name: 'Fixture future model', displayName: 'Fixture Future Model',
      description: '', contextWindow: null, capabilities: [], isRecommended: false,
      supportedReasoningEfforts: ['future_balanced', 'future_deep'],
    });
    expect(publicMode).not.toHaveProperty('quota');
    expect(fields).toEqual(original);
    expect(publicModel.supportedReasoningEfforts).not.toBe(fields.agentic.available_models[0].supportedReasoningEfforts);

    // The settings screen resubmits its GET catalog together with the edited preference.
    const existing = {
      id: 'fixture-connection', catalog_id: 'fixture-catalog', name: 'Fixture connection',
      use_agentic: true, use_api_key: false, default_mode: 'agentic', is_active: true, fields,
    } as AiProvider;
    const update = resolveAiProviderUpdate({ fields: { agentic: {
      ...publicMode, thinking_level: 'future_deep', thinking_levels: { [modelId]: 'future_deep' },
    } } }, existing, null);
    const connection = projectNodiaAiConnection({
      id: existing.id, label: 'Fixture connection', provider_key: 'openai', is_active: true,
      is_default: false, default_mode: 'agentic', catalog_active: true,
      use_agentic: true, use_api_key: false, can_use_agentic: true, can_use_api_key: true,
      fields: update.fields,
    });
    const agentic = connection.modes.find(mode => mode.mode === 'agentic')!;
    expect(agentic.models[0].efforts).toEqual([
      { effort_id: 'future_balanced', label: 'future_balanced' },
      { effort_id: 'future_deep', label: 'future_deep' },
    ]);
    expect(agentic.configured_selection?.effort_id).toBe('future_deep');
    expect(agentic).toMatchObject({ authentication: 'unknown', inference: 'unknown', tools: 'unknown', observed_at: null });
  });

  it.each([
    undefined, null, 'high', [null], [{}], [42], ['HIGH'], ['has space'], [''], ['future', {}], Array(1),
    ['a'.repeat(33)], Array.from({ length: 33 }, (_, index) => `effort_${index}`),
  ])('omits invalid effort metadata rather than inventing choices (%j)', value => {
    const projected = configuredModelFields({ available_models: [{ id: 'fixture-model', supportedReasoningEfforts: value }] });
    expect(firstModel(projected)).not.toHaveProperty('supportedReasoningEfforts');
  });

  it('preserves reported empty options and the transport boundary without inheriting across scopes', () => {
    const efforts = Array.from({ length: 32 }, (_, index) => index === 0 ? 'a'.repeat(32) : `future_${index}`);
    const fields = configuredModelFields({
      available_models: [{ id: 'root', supportedReasoningEfforts: efforts }],
      agentic: { available_models: [{ id: 'agentic', supportedReasoningEfforts: [] }] },
      api_key: { available_models: [{ id: 'api' }] },
    });
    expect(firstModel(fields).supportedReasoningEfforts).toEqual(efforts);
    expect(firstModel(fields.agentic as Record<string, unknown>).supportedReasoningEfforts).toEqual([]);
    expect(firstModel(fields.api_key as Record<string, unknown>)).not.toHaveProperty('supportedReasoningEfforts');
  });
});
