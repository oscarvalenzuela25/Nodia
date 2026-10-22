import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { FactoryProvider } from '@nestjs/common';
import type { WriteContractBundle } from '../../nodia-ai-write-tools/types/write-tool-contract.types.js';
import {
  NodiaAiWriteToolsModule,
  NODIA_AI_CANDIDATE_WRITE_FAMILIES,
} from '../../nodia-ai-write-tools/nodia-ai-write-tools.module.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolRegistration,
} from '../types/tool-registry.types.js';
import { NodiaAiToolRegistryUseCase } from './nodia-ai-tool-registry.use-case.js';
import { ComposeNodiaAiPublishedFamiliesUseCase } from './compose-nodia-ai-published-families.use-case.js';

const sourceJson = JSON.stringify({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://nodia.local/fixtures/compose-publication/1',
  $defs: {
    Empty: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
    EntitySearchInput: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
    EntityCandidates: {
      type: 'object',
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
});
const schema = {
  sourceJson,
  sha256: createHash('sha256').update(sourceJson).digest('hex'),
  definition: 'Empty',
};
function capability(
  name: string,
  resource = 'actions',
  moduleKey = 'actions',
  route = '/settings/actions',
): NodiaAiToolRegistration {
  return {
    capabilityId: name,
    toolName: name,
    revision: 1,
    publication: 'published',
    kind: 'prepare_change',
    moduleKey,
    resourceKey: resource,
    operationKey: 'prepare_create',
    descriptionKey: name,
    description: 'Synthetic proposal preparation',
    requiredModuleRoutes: [route],
    actionKeys: ['synthetic:manage'],
    effectKey: 'synthetic:prepare',
    inputSchema: schema,
    outputSchema: schema,
    verifyAuthority: async () => {},
    handler: async () => ({}),
  };
}
function fixture() {
  const reads: NodiaAiToolFamily[] = [
    {
      familyKey: 'core_settings',
      modules: [
        {
          key: 'actions',
          route: '/settings/actions',
          label: 'Canonical actions',
        },
      ],
      resources: [
        {
          key: 'actions',
          label: 'Actions',
          requiredModuleRoutes: ['/settings/actions'],
          resolveCapabilityId: 'nodia_actions_list',
        },
      ],
      capabilities: [
        {
          ...capability('nodia_actions_list'),
          kind: 'read',
          operationKey: 'list',
          inputSchema: { ...schema, definition: 'EntitySearchInput' },
          outputSchema: { ...schema, definition: 'EntityCandidates' },
        },
      ],
    },
  ];
  const writes: NodiaAiToolFamily[] = [
    {
      familyKey: 'write_core',
      modules: [
        {
          key: 'write_actions',
          route: '/settings/actions',
          label: 'Candidate actions',
        },
      ],
      resources: [
        {
          key: 'actions',
          label: 'Candidate actions',
          requiredModuleRoutes: ['/settings/actions'],
        },
      ],
      capabilities: [
        capability('nodia_actions_prepare_create', 'actions', 'write_actions'),
      ],
    },
  ];
  return {
    reads,
    writes,
    compose: new ComposeNodiaAiPublishedFamiliesUseCase(),
  };
}

describe('ComposeNodiaAiPublishedFamiliesUseCase', () => {
  it('compiles the empty publication module with no proposal, SQL, Redis or runtime dependencies', async () => {
    const empty = NodiaAiWriteToolsModule.forPublication([]);
    expect(empty.imports).toBeUndefined();
    const module = await Test.createTestingModule({
      imports: [empty],
    }).compile();
    try {
      expect(module.get(NODIA_AI_CANDIDATE_WRITE_FAMILIES)).toEqual([]);
    } finally {
      await module.close();
    }
  });
  it('recognizes all four secure candidates for explicit publication without activating them by default', () => {
    for (const name of [
      'nodia_secure_flows_prepare_api_key_create',
      'nodia_secure_flows_prepare_api_key_update',
      'nodia_secure_flows_prepare_connection_login',
      'nodia_secure_flows_prepare_nodia_logout',
    ]) {
      const selected = NodiaAiWriteToolsModule.forPublication([name]);
      expect(selected.imports).toBeDefined();
      expect(selected.providers).toContainEqual(
        expect.objectContaining({ provide: NODIA_AI_CANDIDATE_WRITE_FAMILIES }),
      );
    }
    expect(NodiaAiWriteToolsModule.forPublication([]).imports).toBeUndefined();
  });
  it('rejects duplicate or unknown publication IDs before initializing native writers', () => {
    expect(() =>
      NodiaAiWriteToolsModule.forPublication([
        'nodia_not_registered_prepare_create',
      ]),
    ).toThrow('nodia_ai:knowledge_release_invalid');
    expect(() =>
      NodiaAiWriteToolsModule.forPublication([
        'nodia_users_prepare_create',
        'nodia_users_prepare_create',
      ]),
    ).toThrow('nodia_ai:knowledge_release_invalid');
  });
  it('builds the unchanged 73-contract bundles plus four separate secure contracts and selects only requested exports with stable hashes', () => {
    const { writes } = fixture();
    const candidates = [
      {
        ...writes[0],
        capabilities: [
          ...writes[0].capabilities,
          capability(
            'nodia_actions_prepare_update',
            'actions',
            'write_actions',
          ),
        ],
      },
    ];
    const publication = NodiaAiWriteToolsModule.forPublication([
      'nodia_actions_prepare_create',
    ]);
    const provider = publication.providers?.find(
      (entry): entry is FactoryProvider<readonly NodiaAiToolFamily[]> =>
        typeof entry === 'object' &&
        entry !== null &&
        'provide' in entry &&
        entry.provide === NODIA_AI_CANDIDATE_WRITE_FAMILIES &&
        'useFactory' in entry,
    );
    expect(provider).toBeDefined();
    let captured: readonly WriteContractBundle[] = [];
    // Only the domain assembly is synthetic here; publication filtering and Registry hashing are real.
    const result = provider!.useFactory({
      execute: (bundles: readonly WriteContractBundle[]) => {
        captured = bundles;
        return candidates;
      },
    }) as readonly NodiaAiToolFamily[];
    expect(captured).toHaveLength(4);
    expect(captured.flatMap((bundle) => bundle.tools)).toHaveLength(77);
    expect(captured.slice(0, 3).flatMap((bundle) => bundle.tools)).toHaveLength(
      73,
    );
    expect(
      captured[3].tools.every((tool) => tool.kind === 'prepare_secure_flow'),
    ).toBe(true);
    expect(
      captured
        .flatMap((bundle) => bundle.tools)
        .some((entry) => entry.tool_name === 'nodia_users_prepare_create'),
    ).toBe(true);
    expect(
      result
        .flatMap((family) => family.capabilities)
        .map((entry) => entry.capabilityId),
    ).toEqual(['nodia_actions_prepare_create']);
    const complete = new NodiaAiToolRegistryUseCase(
      candidates,
      'synthetic-release',
    );
    const selected = new NodiaAiToolRegistryUseCase(
      result,
      'synthetic-release',
    );
    expect(selected.get('nodia_actions_prepare_create')?.contractHash).toBe(
      complete.get('nodia_actions_prepare_create')?.contractHash,
    );
    expect(selected.get('nodia_actions_prepare_update')).toBeUndefined();
  });
  it('returns read families unchanged by identity and bytes when no writes are approved', () => {
    const { reads, writes, compose } = fixture();
    expect(compose.execute(reads, [])).toBe(reads);
    expect(compose.execute(reads, [{ ...writes[0], capabilities: [] }])).toBe(
      reads,
    );
    const first = new NodiaAiToolRegistryUseCase(reads, 'synthetic-release');
    const second = new NodiaAiToolRegistryUseCase(
      compose.execute(reads, []),
      'synthetic-release',
    );
    expect(
      second.list(['/settings/actions']).map((entry) => entry.contractHash),
    ).toEqual(
      first.list(['/settings/actions']).map((entry) => entry.contractHash),
    );
  });
  it('attaches a writer to the existing resource without changing native authority or read contracts', () => {
    const { reads, writes, compose } = fixture();
    const original = JSON.stringify(reads);
    const result = compose.execute(reads, writes);
    expect(JSON.stringify(reads)).toBe(original);
    expect(result).toHaveLength(1);
    expect(result[0].resources).toEqual(reads[0].resources);
    expect(result[0].capabilities[0]).toBe(reads[0].capabilities[0]);
    const writer = result[0].capabilities[1],
      candidate = writes[0].capabilities[0];
    expect(writer.moduleKey).toBe('actions');
    expect(writer.requiredModuleRoutes).toBe(candidate.requiredModuleRoutes);
    expect(writer.actionKeys).toBe(candidate.actionKeys);
    expect(writer.handler).toBe(candidate.handler);
    expect(writer.verifyAuthority).toBe(candidate.verifyAuthority);
    expect(writer.inputSchema).toBe(candidate.inputSchema);
    expect(result[0].modules).toEqual(reads[0].modules);
    const prior = new NodiaAiToolRegistryUseCase(reads, 'synthetic-release');
    const registry = new NodiaAiToolRegistryUseCase(
      result,
      'synthetic-release',
    );
    expect(registry.list(['/settings/actions'])).toHaveLength(2);
    expect(registry.findCapability('nodia_actions_list')?.contractHash).toBe(
      prior.findCapability('nodia_actions_list')?.contractHash,
    );
  });
  it('owns new resources in a separate write family with canonical module metadata', () => {
    const { reads, writes, compose } = fixture();
    writes[0] = {
      ...writes[0],
      resources: [
        {
          key: 'action_groups',
          label: 'Groups',
          requiredModuleRoutes: ['/settings/actions'],
        },
      ],
      capabilities: [
        capability(
          'nodia_action_groups_prepare_create',
          'action_groups',
          'write_actions',
        ),
      ],
    };
    const result = compose.execute(reads, writes);
    expect(result).toHaveLength(2);
    expect(result[1].modules).toEqual(reads[0].modules);
    expect(result[1].capabilities[0].moduleKey).toBe('actions');
    expect(
      new NodiaAiToolRegistryUseCase(result, 'synthetic-release').list([
        '/settings/actions',
      ]),
    ).toHaveLength(2);
  });
  it('consolidates two writer families sharing a new resource under one owner', () => {
    const { writes, compose } = fixture();
    const second = {
      ...writes[0],
      familyKey: 'write_more',
      capabilities: [
        capability('nodia_actions_prepare_update', 'actions', 'write_actions'),
      ],
    };
    const result = compose.execute([], [...writes, second]);
    expect(result).toHaveLength(1);
    expect(result[0].resources).toHaveLength(1);
    expect(
      new NodiaAiToolRegistryUseCase(result, 'synthetic-release').list([
        '/settings/actions',
      ]),
    ).toHaveLength(2);
  });
  it('rejects conflicting resource scope or resolver instead of broadening an existing resource', () => {
    for (const patch of [
      { requiredModuleRoutes: ['/settings/users'] },
      { resolveCapabilityId: 'nodia_unknown_list' },
    ]) {
      const { reads, writes, compose } = fixture();
      writes[0] = {
        ...writes[0],
        resources: [{ ...writes[0].resources[0], ...patch }],
      };
      expect(() => compose.execute(reads, writes)).toThrow(
        'nodia_ai:tool_registry_invalid',
      );
    }
  });
  it('rejects duplicate capability IDs, wire names, resource declarations and orphan references', () => {
    for (const change of [
      'id',
      'name',
      'resource',
      'module',
      'orphan',
    ] as const) {
      const { reads, writes, compose } = fixture();
      const entry = writes[0];
      if (change === 'id')
        writes[0] = {
          ...entry,
          capabilities: [
            { ...entry.capabilities[0], capabilityId: 'nodia_actions_list' },
          ],
        };
      if (change === 'name')
        writes[0] = {
          ...entry,
          capabilities: [
            { ...entry.capabilities[0], toolName: 'nodia_actions_list' },
          ],
        };
      if (change === 'resource')
        writes[0] = {
          ...entry,
          resources: [...entry.resources, ...entry.resources],
        };
      if (change === 'module')
        writes[0] = { ...entry, modules: [...entry.modules, ...entry.modules] };
      if (change === 'orphan')
        writes[0] = {
          ...entry,
          capabilities: [{ ...entry.capabilities[0], resourceKey: 'missing' }],
        };
      expect(() => compose.execute(reads, writes), change).toThrow(
        'nodia_ai:tool_registry_invalid',
      );
    }
  });
  it('rejects module keys that point at two routes and family-key collisions for new resources', () => {
    const { reads, writes, compose } = fixture();
    writes[0] = {
      ...writes[0],
      modules: [
        { key: 'actions', route: '/settings/users', label: 'Conflict' },
      ],
    };
    expect(() => compose.execute(reads, writes)).toThrow(
      'nodia_ai:tool_registry_invalid',
    );
    const next = fixture();
    next.writes[0] = {
      ...next.writes[0],
      familyKey: next.reads[0].familyKey,
      resources: [
        {
          key: 'new_resource',
          label: 'New',
          requiredModuleRoutes: ['/settings/actions'],
        },
      ],
      capabilities: [
        capability('nodia_new_prepare_create', 'new_resource', 'write_actions'),
      ],
    };
    expect(() => next.compose.execute(next.reads, next.writes)).toThrow(
      'nodia_ai:tool_registry_invalid',
    );
  });
});
