import { describe, expect, it } from 'vitest';
import { connectionFixture } from './nodia-ai-connections.fixture.js';
import {
  configuredNodiaAiSelection,
  defaultNodiaAiSelection,
} from './nodia-ai-configured-selection.js';

describe('NodiaAI configured defaults', () => {
  it('resolves exact default connection, mode, selected model and per-model effort without discovery or inference', () => {
    const { row } = connectionFixture();
    row.is_default = true;
    row.default_mode = 'api_key';
    row.fields = {
      agentic: { selected_model: 'other-mode', thinking_level: 'other-effort' },
      api_key: {
        selected_model: 'dynamic-model',
        thinking_level: 'high',
        thinking_levels: { 'dynamic-model': 'low' },
      },
    };
    expect(defaultNodiaAiSelection(row)).toEqual({
      connection_id: row.id,
      mode: 'api_key',
      model_id: 'dynamic-model',
      effort_id: 'low',
    });
    expect(row.default_mode).toBe('api_key');
  });

  it.each([
    { is_default: false },
    { is_active: false },
    { catalog_active: false },
    { default_mode: null },
    { default_mode: 'token_plan_web' },
    { default_mode: 'token_plan_agentic' },
    { default_mode: 'future_mode' },
    { use_agentic: false },
    { can_use_agentic: false },
  ])(
    'leaves an invalid/inactive/historical default unassigned: %j',
    (change) => {
      const { row } = connectionFixture();
      Object.assign(row, { is_default: true, default_mode: 'agentic' }, change);
      expect(defaultNodiaAiSelection(row)).toBeNull();
    },
  );

  it('does not fall back to another connection, mode, discovered model or root configuration', () => {
    expect(defaultNodiaAiSelection(null)).toBeNull();
    const { row } = connectionFixture();
    row.is_default = true;
    row.default_mode = 'agentic';
    row.fields = {
      selected_model: 'historical-root',
      agentic: { available_models: [{ id: 'first-discovered' }] },
      api_key: { selected_model: 'configured-other-mode' },
    };
    expect(defaultNodiaAiSelection(row)).toBeNull();
  });

  it('preserves explicit null effort and never inherits the preference of another model', () => {
    const { row } = connectionFixture();
    row.fields = {
      api_key: {
        selected_model: 'dynamic',
        thinking_level: 'high',
        thinking_levels: { dynamic: null, 'other-model': 'low' },
      },
    };
    expect(configuredNodiaAiSelection(row, 'api_key')?.effort_id).toBeNull();
    row.fields = {
      api_key: {
        selected_model: 'dynamic',
        thinking_levels: { 'other-model': 'high' },
      },
    };
    expect(configuredNodiaAiSelection(row, 'api_key')?.effort_id).toBeNull();
  });

  it.each([
    null,
    [],
    { agentic: null },
    { agentic: { selected_model: '' } },
    { agentic: { selected_model: 'x'.repeat(1025) } },
    { agentic: { selected_model: 'dynamic', thinking_level: false } },
    { agentic: { selected_model: 'dynamic', thinking_levels: { dynamic: 0 } } },
  ])('leaves missing/invalid configuration unassigned: %j', (fields) => {
    const { row } = connectionFixture();
    row.fields = fields;
    expect(configuredNodiaAiSelection(row, 'agentic')).toBeNull();
  });
});
