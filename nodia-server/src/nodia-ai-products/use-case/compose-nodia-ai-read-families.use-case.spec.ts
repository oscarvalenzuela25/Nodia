import { describe, expect, it } from 'vitest';
import { ComposeNodiaAiReadFamiliesUseCase } from './compose-nodia-ai-read-families.use-case.js';
import { createNodiaAiAiSettingsReadFamily } from '../ai-settings/ai-settings-read.family.js';
import { NodiaAiToolRegistryUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';

describe('ComposeNodiaAiReadFamiliesUseCase', () => {
  it('keeps candidates dormant when the compiled publication has no capabilities', () => {
    expect(
      new ComposeNodiaAiReadFamiliesUseCase().execute(
        [createNodiaAiAiSettingsReadFamily()],
        [],
      ),
    ).toEqual([]);
  });
  it('registers only the approved exact export without widening resources or names', () => {
    const selected = new ComposeNodiaAiReadFamiliesUseCase().execute(
      [createNodiaAiAiSettingsReadFamily()],
      ['nodia_api_keys_list'],
    );
    const registry = new NodiaAiToolRegistryUseCase(
      selected,
      'synthetic-publication',
    );
    expect(registry.requirements().map((item) => item.capability_id)).toEqual([
      'nodia_api_keys_list',
    ]);
    expect(registry.get('nodia_ai_providers_list')).toBeUndefined();
    expect(selected[0].resources).toHaveLength(1);
  });
  it('rejects invented or repeated approval IDs and duplicate executable candidates', () => {
    const family = createNodiaAiAiSettingsReadFamily(),
      subject = new ComposeNodiaAiReadFamiliesUseCase();
    expect(() => subject.execute([family], ['nodia_invented'])).toThrow(
      'knowledge_release_invalid',
    );
    expect(() =>
      subject.execute([family], ['nodia_api_keys_list', 'nodia_api_keys_list']),
    ).toThrow('knowledge_release_invalid');
    expect(() =>
      subject.execute([family, family], ['nodia_api_keys_list']),
    ).toThrow('knowledge_release_invalid');
  });
});
