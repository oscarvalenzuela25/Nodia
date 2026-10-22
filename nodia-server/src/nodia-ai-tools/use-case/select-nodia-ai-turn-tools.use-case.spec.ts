import { describe, expect, it } from 'vitest';
import { knowledgeHash } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import type { NodiaAiRegisteredTool } from '../types/tool-registry.types.js';
import type {
  NodiaAiSelectTurnToolsInput,
  NodiaAiToolSelectionProfiles,
} from '../types/tool-selection.types.js';
import {
  loadNodiaAiToolSelectionProfiles,
  SelectNodiaAiTurnToolsUseCase,
} from './select-nodia-ai-turn-tools.use-case.js';

const emptySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
};
function tool(id: string): NodiaAiRegisteredTool {
  return {
    capabilityId: id,
    toolName: id,
    contractHash: knowledgeHash(id),
    revision: 1,
    publication: 'published',
    kind: 'read',
    moduleKey: 'synthetic',
    resourceKey: 'synthetic',
    operationKey: 'read',
    descriptionKey: 'synthetic:read',
    description: 'Synthetic permitted read.',
    requiredModuleRoutes: ['/tools/synthetic'],
    actionKeys: [],
    effectKey: 'synthetic:read',
    inputSchema: emptySchema,
    outputSchema: emptySchema,
    inputSchemaRef: 'fixture#/$defs/Input',
    outputSchemaRef: 'fixture#/$defs/Output',
    requiredFields: [],
    optionalFields: [],
    requirement: {
      capability_id: id,
      revision: 1,
      input_schema_sha256: knowledgeHash('input'),
      output_schema_sha256: knowledgeHash('output'),
    },
    handler: async () => ({}),
    verifyAuthority: async () => {},
  };
}
function fixture() {
  const profiles = {
    ...loadNodiaAiToolSelectionProfiles(),
    default_profile_id: 'published_reads',
  };
  const registeredTools = [
    ...new Set(
      profiles.profiles.flatMap((profile) => [...profile.capability_ids]),
    ),
  ].map(tool);
  const input: NodiaAiSelectTurnToolsInput = {
    registeredTools,
    publishedCapabilityIds: registeredTools.map((item) => item.capabilityId),
    authorizedToolNames: registeredTools.map((item) => item.toolName),
    technicalTools: profiles.technical_tool_names.map((name) => ({
      descriptor: {
        name,
        description: 'Synthetic technical helper.',
        inputSchema: emptySchema,
      },
      contractHash: knowledgeHash(name),
    })),
  };
  return { profiles, input, useCase: new SelectNodiaAiTurnToolsUseCase() };
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('SelectNodiaAiTurnToolsUseCase', () => {
  it('starts production in discovery with no domain grant before automatic selection', () => {
    const f = fixture();
    const selected = f.useCase.execute(f.input);
    expect(selected.profile.profile_id).toBe('automatic_discovery');
    expect(selected.capabilityIds).toEqual([]);
    expect(selected.descriptors).toHaveLength(7);
  });
  it('keeps the explicit historical 67 reads and all seven helpers as default', () => {
    const f = fixture();
    const selected = f.useCase.execute(f.input, f.profiles);
    expect(selected.profile.profile_id).toBe('published_reads');
    expect(selected.capabilityIds).toHaveLength(67);
    expect(selected.descriptors).toHaveLength(74);
    expect(selected.capabilityIds).not.toContain(
      'nodia_finance_movements_prepare_create',
    );
    expect(Object.keys(selected.toolContracts)).toHaveLength(74);
    expect(selected.catalogUtf8Bytes).toBeGreaterThan(0);
    expect(Object.isFrozen(selected.toolContracts)).toBe(true);
    expect(Object.isFrozen(selected.descriptors[0].inputSchema)).toBe(true);
  });
  it('selects exactly the 11 finance reads and seven approved pilot IDs without another product', () => {
    const f = fixture();
    const selected = f.useCase.execute(
      { ...f.input, profileId: 'finance_assistance' },
      f.profiles,
    );
    expect(selected.capabilityIds).toHaveLength(18);
    expect(selected.descriptors).toHaveLength(25);
    expect(selected.capabilityIds).toContain(
      'nodia_finance_movements_prepare_create',
    );
    expect(selected.capabilityIds).not.toContain('nodia_actions_get');
    expect(selected.capabilityIds).toEqual(
      [...f.profiles.profiles[1].capability_ids].sort(),
    );
  });
  it('intersects optional catalog reads with current authority rather than expanding a grant', () => {
    const f = fixture();
    const selected = f.useCase.execute(
      { ...f.input, authorizedToolNames: ['nodia_finance_categories_list'] },
      f.profiles,
    );
    expect(selected.capabilityIds).toEqual(['nodia_finance_categories_list']);
    expect(selected.descriptors).toHaveLength(8);
  });
  it('does not silently degrade a pilot missing one essential current permission', () => {
    const f = fixture();
    expect(() =>
      f.useCase.execute(
        {
          ...f.input,
          profileId: 'finance_assistance',
          authorizedToolNames: f.input.authorizedToolNames.filter(
            (name) => name !== 'nodia_finance_movements_prepare_create',
          ),
        },
        f.profiles,
      ),
    ).toThrow('nodia_ai:capability_denied');
  });
  it('recovers only the exact admitted profile revision and fingerprint', () => {
    const f = fixture();
    const selected = f.useCase.execute(
      { ...f.input, profileId: 'finance_assistance' },
      f.profiles,
    );
    expect(
      f.useCase.execute(
        { ...f.input, expectedProfile: selected.profile },
        f.profiles,
      ),
    ).toEqual(selected);
    for (const changed of [
      { revision: 2 },
      { sha256: 'a'.repeat(64) },
      { schema_version: 2 },
    ]) {
      expect(() =>
        f.useCase.execute(
          {
            ...f.input,
            expectedProfile: {
              ...selected.profile,
              ...changed,
            } as typeof selected.profile,
          },
          f.profiles,
        ),
      ).toThrow('nodia_ai:tool_selection_changed');
    }
    expect(() =>
      f.useCase.execute(
        {
          ...f.input,
          profileId: 'published_reads',
          expectedProfile: selected.profile,
        },
        f.profiles,
      ),
    ).toThrow('nodia_ai:tool_selection_changed');
  });
  it('profile identity ignores harmless list ordering but includes every declared capability', () => {
    const f = fixture();
    const first = f.useCase.execute(f.input, f.profiles);
    const reordered = copy(f.profiles);
    (reordered.profiles[0].capability_ids as string[]).reverse();
    expect(f.useCase.execute(f.input, reordered).profile).toEqual(
      first.profile,
    );
    const changed = copy(f.profiles);
    (changed.profiles[0].capability_ids as string[]).pop();
    expect(() =>
      f.useCase.execute(
        { ...f.input, expectedProfile: first.profile },
        changed,
      ),
    ).toThrow('nodia_ai:tool_selection_changed');
  });
  it('rejects an unknown requested profile before providing any descriptors', () => {
    const f = fixture();
    expect(() =>
      f.useCase.execute({ ...f.input, profileId: 'invented' }, f.profiles),
    ).toThrow('nodia_ai:tool_selection_unknown');
  });
  it.each(['unregistered', 'unpublished', 'unimplemented'] as const)(
    'rejects a %s profile member, never omitting it for budget',
    (variant) => {
      const f = fixture();
      const name = f.profiles.profiles[0].capability_ids[0];
      const input = { ...f.input };
      if (variant === 'unregistered')
        input.registeredTools = input.registeredTools.filter(
          (item) => item.capabilityId !== name,
        );
      if (variant === 'unpublished')
        input.publishedCapabilityIds = input.publishedCapabilityIds.filter(
          (id) => id !== name,
        );
      if (variant === 'unimplemented')
        input.registeredTools = input.registeredTools.map((item) =>
          item.capabilityId === name
            ? { ...item, kind: 'analyze_attachment' as const }
            : item,
        );
      expect(() => f.useCase.execute(input, f.profiles)).toThrow(
        'nodia_ai:tool_selection_unpublished',
      );
    },
  );
  it('rejects a catalog over 131072 bytes instead of selecting a partial prefix', () => {
    const f = fixture();
    const registeredTools = f.input.registeredTools.map((item) => ({
      ...item,
      description: 'x'.repeat(2048),
    }));
    expect(() =>
      f.useCase.execute({ ...f.input, registeredTools }, f.profiles),
    ).toThrow('nodia_ai:tool_catalog_limit');
  });
  it.each(['missing', 'duplicate', 'unknown', 'hash'] as const)(
    'requires exact complete technical helpers: %s',
    (variant) => {
      const f = fixture();
      const technicalTools = [...f.input.technicalTools];
      if (variant === 'missing') technicalTools.pop();
      if (variant === 'duplicate') technicalTools[1] = technicalTools[0];
      if (variant === 'unknown')
        technicalTools[0] = {
          ...technicalTools[0],
          descriptor: { ...technicalTools[0].descriptor, name: 'invented' },
        };
      if (variant === 'hash')
        technicalTools[0] = { ...technicalTools[0], contractHash: '' };
      expect(() =>
        f.useCase.execute({ ...f.input, technicalTools }, f.profiles),
      ).toThrow('nodia_ai:tool_selection_invalid');
    },
  );
  it('cannot use a deployment profile as an implicit source of authority or business state', () => {
    const f = fixture();
    const selected = f.useCase.execute(
      { ...f.input, authorizedToolNames: [] },
      f.profiles,
    );
    expect(selected.capabilityIds).toEqual([]);
    expect(selected.descriptors).toHaveLength(7);
    expect(
      selected.descriptors.every((item) =>
        f.profiles.technical_tool_names.includes(item.name),
      ),
    ).toBe(true);
  });
});

describe('strict trusted tool selection profiles', () => {
  it.each([
    'extra',
    'profileExtra',
    'duplicateProfile',
    'duplicateId',
    'missingDefault',
    'unknownRequired',
    'tooManyIds',
    'badRevision',
    'duplicateTechnical',
  ] as const)('rejects invalid deployment metadata: %s', (variant) => {
    const f = copy(loadNodiaAiToolSelectionProfiles());
    const document = f as unknown as Record<string, unknown>;
    const profile = f.profiles[0] as unknown as Record<string, unknown>;
    if (variant === 'extra') document.actor_id = '1';
    if (variant === 'profileExtra') profile.endpoint = '/arbitrary';
    if (variant === 'duplicateProfile')
      document.profiles = [f.profiles[0], f.profiles[0]];
    if (variant === 'duplicateId')
      profile.capability_ids = ['duplicated', 'duplicated'];
    if (variant === 'missingDefault') document.default_profile_id = 'missing';
    if (variant === 'unknownRequired')
      profile.required_capability_ids = ['missing'];
    if (variant === 'tooManyIds')
      profile.capability_ids = Array.from(
        { length: 68 },
        (_, index) => `synthetic_${index}`,
      );
    if (variant === 'badRevision') profile.revision = 0;
    if (variant === 'duplicateTechnical')
      document.technical_tool_names = Array(7).fill('duplicated');
    expect(() =>
      loadNodiaAiToolSelectionProfiles(JSON.stringify(document)),
    ).toThrow('nodia_ai:tool_selection_invalid');
  });
  it('rejects duplicate JSON keys and oversized source bytes before using metadata', () => {
    expect(() =>
      loadNodiaAiToolSelectionProfiles(
        '{"schema_version":1,"schema_version":1}',
      ),
    ).toThrow('nodia_ai:tool_selection_invalid');
    expect(() => loadNodiaAiToolSelectionProfiles(' '.repeat(65537))).toThrow(
      'nodia_ai:tool_selection_invalid',
    );
  });
  it('validates cast metadata supplied by internal callers as rigorously as file metadata', () => {
    const f = fixture();
    expect(() =>
      f.useCase.execute(f.input, {
        ...f.profiles,
        unexpected: true,
      } as NodiaAiToolSelectionProfiles),
    ).toThrow('nodia_ai:tool_selection_invalid');
  });
});
