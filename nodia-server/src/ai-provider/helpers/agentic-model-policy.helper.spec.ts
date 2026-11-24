import { describe, expect, it } from 'vitest';
import {
  filterAgenticModels,
  refreshAgenticModelMetadata,
} from './agentic-model-policy.helper.js';

describe('Agentic catalog policy', () => {
  const approved = { id: 'fixture-model', name: 'Live name' };
  const similarlyNamed = { id: 'fixture-model-high', name: 'Another variant' };

  it('intersects live models by exact identifier, independent of activation', () => {
    const models = [approved, similarlyNamed];
    expect(filterAgenticModels({}, models)).toBe(models);
    expect(filterAgenticModels({ allowed_model_ids: [approved.id], available_models: [] }, models)).toEqual([approved]);
  });

  it.each([
    { label: 'empty', policy: [] },
    { label: 'invalid', policy: 'invalid' },
    { label: 'duplicate', policy: ['fixture-model', 'fixture-model'] },
  ])(
    'keeps a $label restriction closed',
    ({ policy }) => {
      expect(filterAgenticModels({ allowed_model_ids: policy }, [approved])).toEqual([]);
    },
  );

  it('refreshes the latest activated models without activating new offers or forgetting temporarily absent models', () => {
    const allowed = { allowed_model_ids: [approved.id, similarlyNamed.id, 'fixture-temporarily-absent'] };
    const legacy = { id: 'fixture-excluded' };
    const currentlyAbsent = { id: 'fixture-temporarily-absent', name: 'Saved name' };
    const stored = [{ id: approved.id, name: 'Previous name' }, legacy, currentlyAbsent];
    const live = [approved, similarlyNamed, legacy];
    expect(refreshAgenticModelMetadata({ ...allowed, available_models: stored }, live)).toEqual([approved, currentlyAbsent]);
    expect(refreshAgenticModelMetadata({ ...allowed, available_models: [] }, live)).toEqual([]);
  });
});
