import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { canonicalKnowledge } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import {
  NodiaAiToolRegistryUseCase,
  compileNodiaAiToolSchema,
} from './nodia-ai-tool-registry.use-case.js';
import type {
  NodiaAiToolFamily,
  NodiaAiToolRegistration,
  NodiaAiToolSchemaReference,
} from '../types/tool-registry.types.js';

function schema(
  definition = 'Input',
  changed?: object,
): NodiaAiToolSchemaReference {
  const sourceJson = JSON.stringify(
    changed ?? {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://nodia.local/synthetic-tools/1',
      $defs: {
        Input: {
          type: 'object',
          additionalProperties: false,
          properties: {
            term: { type: 'string', minLength: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 5 },
          },
          required: ['term'],
        },
        Output: {
          type: 'object',
          additionalProperties: false,
          properties: { count: { type: 'integer', minimum: 0 } },
          required: ['count'],
        },
      },
    },
  );
  return {
    definition,
    sourceJson,
    sha256: createHash('sha256').update(sourceJson).digest('hex'),
  };
}
function fixture(
  overrides: Partial<NodiaAiToolRegistration> = {},
): NodiaAiToolFamily {
  return {
    familyKey: 'synthetic',
    modules: [
      { key: 'finance', route: '/tools/finance', label: 'Synthetic finance' },
      {
        key: 'business',
        route: '/business',
        label: 'Synthetic business',
      },
    ],
    resources: [
      {
        key: 'expenses',
        label: 'Synthetic expenses',
        requiredModuleRoutes: ['/tools/finance'],
      },
    ],
    capabilities: [
      {
        capabilityId: 'synthetic_expenses_list',
        revision: 1,
        publication: 'published',
        toolName: 'nodia_synthetic_expenses_list',
        kind: 'read',
        moduleKey: 'finance',
        resourceKey: 'expenses',
        operationKey: 'list',
        descriptionKey: 'finance.expenses.list',
        description: 'Synthetic test capability only.',
        requiredModuleRoutes: ['/tools/finance'],
        actionKeys: ['finance:read'],
        inputSchema: schema(),
        outputSchema: schema('Output'),
        effectKey: 'read',
        verifyAuthority: vi.fn(async () => {}),
        handler: vi.fn(async () => ({ count: 0 })),
        ...overrides,
      },
    ],
  };
}
const registry = (family = fixture()) =>
  new NodiaAiToolRegistryUseCase([family], 'synthetic-v1');

describe('NodiaAiToolRegistryUseCase', () => {
  it('keeps historical v1 contract hashes when canonical navigation changes', () => {
    const original = fixture();
    const family: NodiaAiToolFamily = { ...original,
      modules: original.modules.map((module, index) => index === 0 ? { ...module, route: '/finances-personal' } : module),
      resources: original.resources.map(resource => ({ ...resource, requiredModuleRoutes: ['/finances-personal'] })),
      capabilities: original.capabilities.map(tool => ({ ...tool, requiredModuleRoutes: ['/finances-personal'] })),
    };
    const subject = registry(family);
    const tool = subject.get('nodia_synthetic_expenses_list')!;
    const { contractHash, handler: _handler, verifyAuthority: _authority,
      verifyResultAuthority: _resultAuthority, external: _external, ...metadata } = tool;
    const historicalHash = createHash('sha256').update(canonicalKnowledge({ catalogVersion: 'synthetic-v1',
      ...metadata, requiredModuleRoutes: ['/tools/finances-personal'],
    })).digest('hex');
    expect(contractHash).toBe(historicalHash);
    expect(tool.requiredModuleRoutes).toEqual(['/finances-personal']);
    expect(subject.list(['/tools/finances-personal'])).toHaveLength(1);
    expect(subject.list(['/business'])).toHaveLength(0);
  });
  it('accepts an empty deployment without inventing business capabilities or modules', () => {
    const subject = new NodiaAiToolRegistryUseCase([], 'synthetic-v1');
    expect(subject.requirements()).toEqual([]);
    expect(subject.publishedContracts()).toEqual([]);
    expect(subject.modules(['/tools/finance'])).toEqual([]);
    expect(subject.resources(['/tools/finance'])).toEqual([]);
    expect(subject.list(['/tools/finance'])).toEqual([]);
  });
  it('registers exact contracts without invoking authority checks or handlers', () => {
    const family = fixture(),
      subject = registry(family),
      tool = subject.get('nodia_synthetic_expenses_list')!;
    expect(tool.requirement).toEqual({
      capability_id: family.capabilities[0].capabilityId,
      revision: 1,
      input_schema_sha256: family.capabilities[0].inputSchema.sha256,
      output_schema_sha256: family.capabilities[0].outputSchema.sha256,
    });
    expect(subject.publishedContracts()).toEqual([
      {
        ...tool.requirement,
        kind: 'read',
        required_module_routes: ['/tools/finance'],
      },
    ]);
    expect(tool.requiredFields).toEqual(['term']);
    expect(tool.optionalFields).toEqual(['limit']);
    expect(subject.findCapability(tool.capabilityId)).toBe(tool);
    expect(family.capabilities[0].handler).not.toHaveBeenCalled();
    expect(family.capabilities[0].verifyAuthority).not.toHaveBeenCalled();
  });
  it('filters all required modules and exposes modules/resources only for available registered capabilities', () => {
    const subject = registry(
      fixture({ requiredModuleRoutes: ['/tools/finance', '/business'] }),
    );
    expect(subject.list(['/tools/finance'])).toEqual([]);
    expect(subject.modules(['/tools/finance'])).toEqual([]);
    expect(subject.resources(['/tools/finance'])).toEqual([]);
    expect(subject.list(['/business', '/tools/finance'])).toHaveLength(1);
    expect(
      subject
        .modules(['/business', '/tools/finance'])
        .map((module) => module.key),
    ).toEqual(['finance']);
    expect(
      subject
        .resources(['/business', '/tools/finance'])
        .map((resource) => resource.key),
    ).toEqual(['expenses']);
  });
  it('defensively copies and freezes metadata without freezing family owned arrays', () => {
    const family = fixture(),
      subject = registry(family),
      tool = subject.get('nodia_synthetic_expenses_list')!;
    (family.capabilities[0].requiredModuleRoutes as string[]).push('/unknown');
    expect(tool.requiredModuleRoutes).toEqual(['/tools/finance']);
    expect(Object.isFrozen(tool)).toBe(true);
    expect(Object.isFrozen(tool.inputSchema.$defs)).toBe(true);
    expect(Object.isFrozen(tool.requiredFields)).toBe(true);
    expect(Object.isFrozen(subject.list(['/tools/finance']))).toBe(true);
  });
  it.each([
    ['draft', { publication: 'draft' }],
    ['execute write kind', { kind: 'execute_change' }],
    ['unknown module', { moduleKey: 'unknown' }],
    ['unknown resource', { resourceKey: 'unknown' }],
    ['missing target route', { requiredModuleRoutes: ['/business'] }],
    [
      'unknown target route',
      { requiredModuleRoutes: ['/tools/finance', '/unknown'] },
    ],
    [
      'duplicate routes',
      { requiredModuleRoutes: ['/tools/finance', '/tools/finance'] },
    ],
    ['unsafe tool name', { toolName: 'SQL select *' }],
    ['zero revision', { revision: 0 }],
    ['out of manifest revision range', { revision: 2147483648 }],
    ['missing capability ID', { capabilityId: undefined }],
    ['incompatible capability ID', { capabilityId: 'synthetic.expenses.list' }],
    ['missing effect key', { effectKey: undefined }],
    ['missing authority', { verifyAuthority: undefined }],
    ['missing handler', { handler: undefined }],
    ['missing description', { description: '' }],
  ])('rejects %s at startup', (_name, patch) => {
    expect(() =>
      registry(fixture(patch as unknown as Partial<NodiaAiToolRegistration>)),
    ).toThrow('nodia_ai:tool_registry_invalid');
  });
  it('rejects duplicate family, tool and capability identities instead of replacing handlers', () => {
    const family = fixture();
    expect(
      () => new NodiaAiToolRegistryUseCase([family, family], 'synthetic-v1'),
    ).toThrow('tool_registry_invalid');
    const second = {
      ...family.capabilities[0],
      capabilityId: 'synthetic_other',
    };
    expect(() =>
      registry({ ...family, capabilities: [...family.capabilities, second] }),
    ).toThrow('tool_registry_invalid');
    expect(() =>
      registry({
        ...family,
        capabilities: [
          ...family.capabilities,
          {
            ...second,
            toolName: 'nodia_other',
            capabilityId: family.capabilities[0].capabilityId,
          },
        ],
      }),
    ).toThrow('tool_registry_invalid');
  });
  it('rejects conflicting module routes and resources across families', () => {
    const first = fixture(),
      second = { ...fixture(), familyKey: 'second', capabilities: [] };
    expect(
      () => new NodiaAiToolRegistryUseCase([first, second], 'synthetic-v1'),
    ).toThrow('tool_registry_invalid');
    expect(() =>
      registry({
        ...first,
        modules: [
          ...first.modules,
          { key: 'other', route: '/tools/finance', label: 'Other' },
        ],
      }),
    ).toThrow('tool_registry_invalid');
  });
  it('validates without coercion, defaults, deletion, or mutation', () => {
    const subject = registry(),
      tool = subject.list(['/tools/finance'])[0],
      input = { term: 'expense', limit: 2 };
    expect(subject.validateInput(tool, input)).toEqual(input);
    expect(subject.validateInput(tool, input)).not.toBe(input);
    expect(input).toEqual({ term: 'expense', limit: 2 });
    for (const invalid of [
      {},
      { term: '' },
      { term: 'a', limit: '2' },
      { term: 'a', limit: 6 },
      { term: 'a', secret: true },
    ])
      expect(() => subject.validateInput(tool, invalid)).toThrow(
        'invalid_tool_input',
      );
    expect(subject.validateOutput(tool, { count: 0 })).toEqual({ count: 0 });
    expect(() => subject.validateOutput(tool, { count: -1 })).toThrow(
      'invalid_tool_output',
    );
    expect(() =>
      subject.validateOutput(tool, { count: 0, secret: 'private' }),
    ).toThrow('invalid_tool_output');
  });
  it.each([undefined, NaN, Infinity, new Date(), () => true, 2n])(
    'rejects lossy non JSON values %s',
    (invalid) => {
      const subject = registry(),
        tool = subject.list(['/tools/finance'])[0];
      expect(() =>
        subject.validateInput(tool, { term: 'x', extra: invalid }),
      ).toThrow('invalid_tool_input');
    },
  );
  it('rejects a descriptor from another registry rather than using its executable handler', () => {
    const first = registry(),
      second = registry();
    expect(() =>
      first.validateInput(second.list(['/tools/finance'])[0], { term: 'x' }),
    ).toThrow('tool_registry_invalid');
  });
  it('validates unique JSON objects without the null-prototype comparator failure', () => {
    const reference = schema('Input', {
      $id: 'https://nodia.local/unique-object-fixture',
      $defs: {
        Input: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rows: {
              type: 'array',
              uniqueItems: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: { id: { type: 'string' } },
                required: ['id'],
              },
            },
          },
          required: ['rows'],
        },
      },
    });
    const subject = registry(fixture({ inputSchema: reference })),
      tool = subject.list(['/tools/finance'])[0];
    expect(
      subject.validateInput(tool, { rows: [{ id: '1' }, { id: '2' }] }),
    ).toEqual({ rows: [{ id: '1' }, { id: '2' }] });
    expect(() =>
      subject.validateInput(tool, { rows: [{ id: '1' }, { id: '1' }] }),
    ).toThrow('invalid_tool_input');
  });
  it('changes contract hash when revision, schema target, effects, authority metadata, or catalog changes', () => {
    const baseline = registry().list(['/tools/finance'])[0].contractHash;
    for (const patch of [
      { revision: 2 },
      { effectKey: 'observe' },
      { actionKeys: ['finance:manage'] },
      { requiredModuleRoutes: ['/tools/finance', '/business'] },
    ])
      expect(
        registry(fixture(patch)).list(['/tools/finance', '/business'])[0]
          .contractHash,
      ).not.toBe(baseline);
    expect(
      new NodiaAiToolRegistryUseCase([fixture()], 'synthetic-v2').list([
        '/tools/finance',
      ])[0].contractHash,
    ).not.toBe(baseline);
  });
  it('rejects entity resolver pointers without an exact published read contract', () => {
    const family = fixture();
    expect(() =>
      registry({
        ...family,
        resources: [{ ...family.resources[0], resolveCapabilityId: 'missing' }],
      }),
    ).toThrow('tool_registry_invalid');
    expect(() =>
      registry({
        ...family,
        resources: [
          {
            ...family.resources[0],
            resolveCapabilityId: family.capabilities[0].capabilityId,
          },
        ],
      }),
    ).toThrow('tool_registry_invalid');
  });
});

describe('compileNodiaAiToolSchema', () => {
  it('rejects raw byte hash mismatch, duplicate JSON fields and missing definitions', () => {
    expect(() =>
      compileNodiaAiToolSchema({
        ...schema(),
        sourceJson: `${schema().sourceJson} `,
      }),
    ).toThrow('tool_registry_invalid');
    expect(() => compileNodiaAiToolSchema(schema('Absent'))).toThrow(
      'tool_registry_invalid',
    );
    const sourceJson = '{"$id":"x","$id":"y"}';
    expect(() =>
      compileNodiaAiToolSchema({
        sourceJson,
        definition: 'Input',
        sha256: createHash('sha256').update(sourceJson).digest('hex'),
      }),
    ).toThrow('tool_registry_invalid');
  });
  it.each([
    { type: 'object', properties: {} },
    {
      type: 'object',
      additionalProperties: false,
      properties: { nested: { type: 'object', additionalProperties: true } },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: { nested: { $ref: 'https://remote.invalid/schema' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: { nested: { $ref: '#/$defs/Absent' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        nested: { anyOf: [{ properties: { exposed: { type: 'string' } } }] },
      },
    },
  ])('rejects open or unresolved reachable schemas', (Input) => {
    expect(() =>
      compileNodiaAiToolSchema(
        schema('Input', { $id: 'https://nodia.local/test', $defs: { Input } }),
      ),
    ).toThrow('tool_registry_invalid');
  });
  it('returns a standalone schema with only reachable definitions and preserves local refs', () => {
    const ref = schema('Input', {
      $id: 'https://nodia.local/test',
      $defs: {
        Input: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { $ref: '#/$defs/Id' } },
          required: ['id'],
        },
        Id: { type: 'string', pattern: '^[0-9]+$' },
        Private: { type: 'object', additionalProperties: true },
      },
    });
    const compiled = compileNodiaAiToolSchema(ref);
    expect(Object.keys(compiled.schema.$defs as object).sort()).toEqual([
      'Id',
      'Input',
    ]);
    const validate = new Ajv2020({ strict: true }).compile(compiled.schema);
    expect(validate({ id: '123' })).toBe(true);
    expect(validate({ id: 123 })).toBe(false);
  });
  it('compiles the existing three common discovery schemas and EntityCandidates from trusted source', () => {
    const sourceJson = readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    );
    for (const definition of [
      'CatalogSearchInput',
      'CatalogSearchResult',
      'CatalogDescribeInput',
      'CapabilityDescriptor',
      'EntitySearchInput',
      'EntityCandidates',
    ]) {
      const compiled = compileNodiaAiToolSchema({
        sourceJson,
        definition,
        sha256: createHash('sha256').update(sourceJson).digest('hex'),
      });
      expect(compiled.schema.type).toBe('object');
      expect(compiled.ref.endsWith(`/$defs/${definition}`)).toBe(true);
    }
  });
});
