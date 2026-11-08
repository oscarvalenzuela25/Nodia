import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiProviderOperationsService } from '../nodia-ai-provider-operations.service.js';
import type { NodiaAiProviderResource as Resource } from '../types/provider-operation.types.js';
import { BuildNodiaAiProviderOperationsUseCase } from './build-nodia-ai-provider-operations.use-case.js';
const session = '1057a24d-4d46-4ca2-93c3-3711284cfb76';
const pairs: [Resource, 'create' | 'update'][] = [
  ['ai_providers', 'create'],
  ['ai_providers', 'update'],
  ['ai_provider_catalog', 'create'],
  ['ai_provider_catalog', 'update'],
];
function fixture() {
  const state = {
    authenticated: true,
    superAdmin: false,
    module: true,
    action: false,
    collision: false,
    missing: false,
    count: 1,
    held: false,
  };
  const catalog: NodiaAiJsonObject = {
    id: '20',
    key: 'gemini',
    name: 'Catalog',
    can_use_api_key: true,
    can_use_agentic: true,
    is_active: true,
  };
  const provider: NodiaAiJsonObject = {
    id: '30',
    catalog_id: '20',
    name: 'Connection',
    use_api_key: false,
    use_agentic: true,
    default_mode: 'agentic',
    auto_rotate_api_keys: true,
    is_default: false,
    is_active: true,
    fields: {
      secret: 'MUST_NOT_LEAK',
      agentic: {
        selected_model: 'model-a',
        ocr_model: 'model-a',
        thinking_level: 'mode-effort',
        thinking_levels: {
          'model-a': 'saved-effort',
        },
        available_models: [
          {
            id: 'model-a',
            supportedReasoningEfforts: ['effort-new'],
            token: 'MUST_NOT_LEAK',
          },
          { id: 'model-b', supportedReasoningEfforts: ['effort-next'] },
        ],
        cookies: 'MUST_NOT_LEAK',
      },
      api_key: { selected_model: 'agent-only' },
    },
  };
  const defaults: NodiaAiJsonObject[] = [
    { id: '31', name: 'Previous default', is_default: true },
  ];
  const translations: NodiaAiJsonObject[] = [
    { key: 'name', es: 'Conexión', en: 'Connection' },
  ];
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('AS authority_locks'))
      return [{ authority_locks: state.held ? 9 : 0 }];
    if (sql.startsWith('LOCK TABLE actions')) state.held = true;
    return sql.startsWith('SELECT u.id')
      ? state.authenticated
        ? [{ actorId: '1', sessionId: session, isSuperAdmin: state.superAdmin }]
        : []
      : sql.startsWith('SELECT (SELECT count')
        ? [{ module: state.module, action: state.action }]
        : [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const store = {
    target: vi.fn(async (_m: EntityManager, resource: Resource) =>
      state.missing
        ? null
        : structuredClone(resource === 'ai_providers' ? provider : catalog),
    ),
    catalogByKey: vi.fn(async () =>
      state.collision ? structuredClone(catalog) : null,
    ),
    defaults: vi.fn(async () => structuredClone(defaults)),
    count: vi.fn(async () => state.count),
    translations: vi.fn(async () => structuredClone(translations)),
    affectedConnections: vi.fn(async () => [
      {
        id: '30',
        name: 'Connection',
        use_api_key: false,
        use_agentic: true,
        is_active: true,
        is_default: false,
      },
    ]),
  };
  const writers = Array.from({ length: 4 }, () => ({
    execute: vi.fn(async (...args: unknown[]) => ({
      id: typeof args[0] === 'string' ? args[0] : '9007199254740993',
    })),
  }));
  const factory = new BuildNodiaAiProviderOperationsUseCase(
    store as unknown as NodiaAiProviderOperationsService,
    ...(writers as unknown as ConstructorParameters<
      typeof BuildNodiaAiProviderOperationsUseCase
    > extends [unknown, ...infer R]
      ? R
      : never),
  );
  const ctx = {
    manager,
    actor: {
      actorId: '1',
      sessionId: session,
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/ai-providers'],
    conversationId: session,
    statementTimeoutMs: 1000,
  } as ProposalPreparerContext;
  const op = (resource: Resource, operation: 'create' | 'update') =>
    factory.operations.find(
      (p) => p.resourceKey === resource && p.operation === operation,
    )!;
  const input = (
    resource: Resource,
    operation: 'create' | 'update',
  ): NodiaAiJsonObject =>
    operation === 'create'
      ? resource === 'ai_providers'
        ? { catalog_id: '20', use_agentic: true }
        : { key: 'synthetic', name: 'New catalog' }
      : { id: resource === 'ai_providers' ? '30' : '20', name: 'Revised' };
  async function ready(
    resource: Resource = 'ai_providers',
    operation: 'create' | 'update' = 'update',
    raw = input(resource, operation),
  ) {
    const port = op(resource, operation),
      result = await port.prepare(raw, ctx);
    if (result.status !== 'ready') throw new Error('not ready');
    const step: StoredProposalStep = {
      id: session,
      toolName: port.toolName,
      contractHash: port.contractHash,
      position: 0,
      outputBindings: [],
      ...result,
    };
    return { port, step };
  }
  return {
    state,
    catalog,
    provider,
    defaults,
    translations,
    query,
    manager,
    store,
    writers,
    factory,
    ctx,
    op,
    input,
    ready,
  };
}
const policy = runtimeFixture().policy;
const validator = new ValidateNodiaAiProposalUseCase(
  fixture().factory.operations,
  readFileSync(
    new URL(
      '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
      import.meta.url,
    ),
    'utf8',
  ),
  policy,
  new CanonicalizeNodiaAiProposalUseCase(policy),
);
describe('AI-28 closed configuration operations', () => {
  for (const [resource, operation] of pairs) {
    it(`${resource}/${operation} prepares a closed preview without mutation or secrets`, async () => {
      const f = fixture(),
        { port, step } = await f.ready(resource, operation);
      expect(port.actionKeys).toEqual(['ai:manage']);
      validator.assert('PublicStep', { ...step.publicStep, step_id: step.id });
      expect(step.scope).toEqual({});
      expect(JSON.stringify(step)).not.toContain('MUST_NOT_LEAK');
      expect(step.publicStep.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field_key: 'configuration_status' }),
        ]),
      );
      for (const writer of f.writers)
        expect(writer.execute).not.toHaveBeenCalled();
    });
    it(`${resource}/${operation} executes same manager and exact bigint receipt after revalidation`, async () => {
      const f = fixture(),
        { port, step } = await f.ready(resource, operation);
      const result = await port.executeConfirmed(step, f.ctx);
      expect(result.id).toBe(
        operation === 'create'
          ? '9007199254740993'
          : resource === 'ai_providers'
            ? '30'
            : '20',
      );
      const writer =
        f.writers[
          pairs.findIndex(([r, o]) => r === resource && o === operation)
        ];
      expect(writer.execute).toHaveBeenCalledOnce();
      expect(writer.execute.mock.calls[0].at(-1)).toEqual(
        expect.objectContaining({
          transaction: f.manager,
          userId: '1',
          sessionId: session,
        }),
      );
      expect(
        f.query.mock.calls.some(
          ([sql]) =>
            sql ===
            'LOCK TABLE ai_provider_catalog, ai_providers IN SHARE ROW EXCLUSIVE MODE',
        ),
      ).toBe(true);
    });
    it(`${resource}/${operation} requires missing minimum inputs`, async () => {
      const f = fixture(),
        result = await f.op(resource, operation).prepare({}, f.ctx);
      expect(result.status).toBe('needs_clarification');
    });
    it(`${resource}/${operation} permits missing role actions and rejects a revoked destination module`, async () => {
      const f = fixture(),
        { port, step } = await f.ready(resource, operation);
      f.state.action = false;
      await expect(port.verifyAuthority(step, f.ctx)).resolves.toBeUndefined();
      f.state.module = false;
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'nodia_ai:capability_denied',
      );
      for (const writer of f.writers)
        expect(writer.execute).not.toHaveBeenCalled();
    });
  }
  for (const field of [
    'fields',
    'api_key',
    'api_keys',
    'cookies',
    'password',
    'token',
    'model',
    'available_models',
    'actor',
    'scope',
    'mode',
    'key',
  ])
    it(`rejects free/secret/legacy field ${field}`, async () => {
      const f = fixture();
      await expect(
        f
          .op('ai_providers', 'update')
          .prepare({ id: '30', [field]: 'forbidden' }, f.ctx),
      ).rejects.toThrow('nodia_ai:invalid_input');
    });
  it('first provider exact defaults appear in preview, without configured or inferred models', async () => {
    const f = fixture();
    f.state.count = 0;
    const { step } = await f.ready('ai_providers', 'create', {
      catalog_id: '20',
    });
    expect(step.commandTemplate.command).toMatchObject({
      name: 'Catalog',
      use_api_key: false,
      use_agentic: false,
      default_mode: null,
      is_default: true,
      is_active: true,
      auto_rotate_api_keys: true,
    });
    expect(JSON.stringify(step)).not.toContain('model-a');
  });
  it('catalog channel flags never imply current availability', async () => {
    const f = fixture(),
      { step } = await f.ready('ai_provider_catalog', 'update', {
        id: '20',
        can_use_agentic: false,
      });
    expect(step.preconditions.configuration_status).toEqual({
      availability: 'unknown',
      changes_chat_configuration: false,
    });
    expect(step.preconditions.affected_connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '30', use_agentic: true }),
      ]),
    );
  });
  it('rejects inactive or unsupported catalog for a new connection', async () => {
    const f = fixture();
    f.catalog.is_active = false;
    await expect(f.ready('ai_providers', 'create')).rejects.toThrow();
    f.catalog.is_active = true;
    f.catalog.key = 'unimplemented-catalog';
    await expect(f.ready('ai_providers', 'create')).rejects.toThrow(
      'integración implementada',
    );
  });
  it('rejects enabling a forbidden channel or disabling the default channel', async () => {
    const f = fixture();
    f.catalog.can_use_agentic = false;
    await expect(f.ready('ai_providers', 'create')).rejects.toThrow(
      'channel_not_allowed',
    );
    f.catalog.can_use_agentic = true;
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        use_agentic: false,
      }),
    ).rejects.toThrow('default_mode_disabled');
  });
  it('freezes every previous global default replaced by the operation', async () => {
    const f = fixture(),
      { port, step } = await f.ready('ai_providers', 'update', {
        id: '30',
        is_default: true,
      });
    expect(step.preconditions.previous_defaults).toEqual(f.defaults);
    f.defaults.push({ id: '32', name: 'Concurrent default', is_default: true });
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'preconditions_changed',
    );
    expect(f.writers[1].execute).not.toHaveBeenCalled();
  });
  it('detects a material catalog flag change without relying on a timestamp', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    f.catalog.can_use_api_key = false;
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'preconditions_changed',
    );
  });
  it('does not freeze unrelated raw secrets or unknown historic options', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    (f.provider.fields as NodiaAiJsonObject).secret = 'NEW_SECRET';
    (f.provider.fields as NodiaAiJsonObject).unknown = { x: 'PRIVATE' };
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
  });
  it('accepts exact dynamic model ID from only the same persisted channel', async () => {
    const f = fixture(),
      { port, step } = await f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'model-b',
      });
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[1].execute.mock.calls[0][1]).toEqual({
      fields: { agentic: { selected_model: 'model-b' } },
    });
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'api_key.selected_model': 'model-b',
      }),
    ).rejects.toThrow('model_unavailable');
  });
  it('keeps a configured historical ID correctable even when not in the discovered catalog', async () => {
    const f = fixture();
    (
      (f.provider.fields as NodiaAiJsonObject).agentic as NodiaAiJsonObject
    ).selected_model = 'retired-id';
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'retired-id',
      }),
    ).resolves.toBeDefined();
  });
  it('updates reasoning per selected model without overwriting another model override', async () => {
    const f = fixture(),
      { port, step } = await f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.thinking_level': 'effort-new',
      });
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[1].execute.mock.calls[0][1]).toMatchObject({
      fields: {
        agentic: {
          thinking_levels: {
            'model-a': 'effort-new',
          },
        },
      },
    });
  });
  it('validates reasoning against the newly chosen model in the same proposal', async () => {
    const f = fixture();
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'model-b',
        'agentic.thinking_level': 'effort-next',
      }),
    ).resolves.toBeDefined();
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'model-b',
        'agentic.thinking_level': 'effort-new',
      }),
    ).rejects.toThrow('reasoning_unavailable');
  });
  it('preserves null as an explicit model-specific reasoning override removal', async () => {
    const f = fixture(),
      { port, step } = await f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.thinking_level': null,
      });
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[1].execute.mock.calls[0][1]).toMatchObject({
      fields: { agentic: { thinking_levels: { 'model-a': null } } },
    });
  });
  it('rejects an invented reasoning option and permits a general configured level without a model', async () => {
    const f = fixture();
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.thinking_level': 'invented',
      }),
    ).rejects.toThrow('reasoning_unavailable');
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': null,
        'agentic.thinking_level': 'low',
      }),
    ).resolves.toBeDefined();
  });
  it('handles flat historic preferences only in their original mode', async () => {
    const f = fixture();
    f.provider.fields = {
      selected_model: 'old-configured',
      available_models: [{ id: 'new-dynamic' }],
      ocr_model: 'old-ocr',
      secret: 'MUST_NOT_LEAK',
    };
    const { step } = await f.ready('ai_providers', 'update', {
      id: '30',
      'agentic.selected_model': 'new-dynamic',
    });
    expect(JSON.stringify(step)).not.toContain('MUST_NOT_LEAK');
    expect(
      (step.preconditions.target as NodiaAiJsonObject)[
        'agentic.selected_model'
      ],
    ).toBe('old-configured');
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'api_key.selected_model': 'new-dynamic',
      }),
    ).rejects.toThrow('model_unavailable');
  });
  it('changes the review revision template through typed edits and rechecks authority', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    const edited = await port.applyEdits(
      step.commandTemplate,
      [{ step_id: session, field_key: 'name', value: 'Edited' }],
      f.ctx,
    );
    expect(edited.command).toMatchObject({ name: 'Edited' });
    f.state.action = false;
    await expect(port.reprepareStored(edited, f.ctx)).resolves.toMatchObject({
      status: 'ready',
    });
    f.state.module = false;
    await expect(port.reprepareStored(edited, f.ctx)).rejects.toThrow(
      'capability_denied',
    );
  });
  it('rejects duplicate edits, secret edits, catalog reassignment and catalog key changes', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    await expect(
      port.applyEdits(
        step.commandTemplate,
        [
          { step_id: session, field_key: 'name', value: 'A' },
          { step_id: session, field_key: 'name', value: 'B' },
        ],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
    await expect(
      f.ready('ai_providers', 'update', { id: '30', catalog_id: '21' }),
    ).rejects.toThrow('invalid_input');
    await expect(
      f.ready('ai_provider_catalog', 'update', { id: '20', key: 'changed' }),
    ).rejects.toThrow('invalid_input');
  });
  it('revalidates the session and refuses inactive transaction or altered binding', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    f.state.authenticated = false;
    await expect(port.verifyAuthority(step, f.ctx)).rejects.toThrow(
      'session_expired',
    );
    f.state.authenticated = true;
    await expect(
      port.verifyAuthority({ ...step, scope: { provider_id: '30' } }, f.ctx),
    ).rejects.toThrow('capability_denied');
    f.manager.queryRunner!.isTransactionActive = false;
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'capability_denied',
    );
  });
  it('superadmin bypasses assignments but requires active modules', async () => {
    const f = fixture();
    f.state.superAdmin = true;
    f.state.action = false;
    await expect(f.ready()).resolves.toBeDefined();
    f.state.module = false;
    await expect(f.ready()).rejects.toThrow('capability_denied');
  });
  it('rejects an unexpected or rounded writer identity', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    f.writers[1].execute.mockResolvedValueOnce({ id: '31' });
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'invalid_effect_result',
    );
  });
  it('bounds persisted model catalogs and rejects non-string model IDs', async () => {
    const f = fixture();
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 1,
      }),
    ).rejects.toThrow('invalid_input');
    (
      (f.provider.fields as NodiaAiJsonObject).agentic as NodiaAiJsonObject
    ).available_models = Array.from({ length: 1001 }, (_, i) => ({
      id: `model-${i}`,
    }));
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'model-1',
      }),
    ).rejects.toThrow('result_too_large');
  });
  for (const mode of ['api_key', 'agentic', 'agentic'])
    it(`configures ${mode} reasoning without discovered capability or assigned model`, async () => {
      const f = fixture();
      f.provider.fields = {};
      const { port, step } = await f.ready('ai_providers', 'update', {
        id: '30',
        [`${mode}.thinking_level`]: 'medium',
      });
      await port.executeConfirmed(step, f.ctx);
      expect(f.writers[1].execute.mock.calls[0][1]).toEqual({
        fields: { [mode]: { thinking_level: 'medium' } },
      });
      expect(step.preconditions.configuration_status).toMatchObject({
        availability: 'unknown',
      });
    });
  it('freezes the chosen destination model override while preserving unrelated map changes', async () => {
    const f = fixture(),
      { port, step } = await f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'model-b',
      });
    const levels = (
      (f.provider.fields as NodiaAiJsonObject).agentic as NodiaAiJsonObject
    ).thinking_levels as NodiaAiJsonObject;
    levels['unrelated-model'] = 'other-value';
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
    levels['model-b'] = 'changed-destination-effort';
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'preconditions_changed',
    );
  });
  for (const [resource, operation] of pairs)
    it(`compiles the exact ${resource}/${operation} review with registered fields`, async () => {
      const f = fixture(),
        { step, port } = await f.ready(resource, operation),
        now = new Date('2030-05-03T12:00:00Z');
      const proposal = Object.assign(new NodiaAiProposal(), {
        id: session,
        conversation_id: session,
        actor_id: '1',
        current_revision: 1,
        created_at: now,
      });
      const revision = Object.assign(new NodiaAiProposalRevision(), {
        proposal_id: session,
        revision: 1,
        state: 'ready',
        hash: '',
        catalog_version: port.catalogVersion,
        canonicalization_version: 'jcs-rfc8785/1',
        created_at: now,
        expires_at: new Date(now.getTime() + 900000),
      });
      const stored = Object.assign(new NodiaAiProposalStep(), {
        id: step.id,
        proposal_id: session,
        proposal_revision: 1,
        position: 1,
        tool_name: step.toolName,
        contract_hash: step.contractHash,
        kind: 'domain_change',
        effect_key: step.publicStep.effect_key,
        scope: step.scope,
        command_template: step.commandTemplate,
        preconditions: step.preconditions,
        output_bindings: [],
        public_step: { ...step.publicStep, step_id: step.id },
      });
      expect(() =>
        validator.compile(proposal, revision, [stored], false),
      ).not.toThrow();
    });
  it('does not reset inherited authority lock or statement budget on revalidation', async () => {
    const f = fixture(),
      { port, step } = await f.ready();
    f.query.mockClear();
    await port.executeConfirmed(step, f.ctx);
    expect(
      f.query.mock.calls.filter(
        ([sql]) =>
          sql.startsWith('SET LOCAL') || sql.startsWith('LOCK TABLE actions'),
      ),
    ).toEqual([]);
  });
  it('rejects explicit OpenAI Web activation while retaining a historical untouched flag', async () => {
    const f = fixture();
    f.catalog.key = 'openai';
    await expect(
      f.ready('ai_provider_catalog', 'update', {
        id: '20',
        can_use_token_plan_web: true,
      }),
    ).rejects.toThrow('invalid_input');
    await expect(
      f.ready('ai_providers', 'update', { id: '30', use_token_plan_web: true }),
    ).rejects.toThrow('invalid_input');
    await expect(
      f.ready('ai_provider_catalog', 'update', {
        id: '20',
        name: 'Still configured',
      }),
    ).resolves.toBeDefined();
    await expect(
      f.ready('ai_providers', 'update', {
        id: '30',
        name: 'Historical preserved',
      }),
    ).resolves.toBeDefined();
  });
  it('normalizes new catalog identity before applying retired Web policy', async () => {
    const f = fixture();
    await expect(
      f.ready('ai_provider_catalog', 'create', {
        key: ' OpenAI ',
        name: 'Catalog',
        can_use_token_plan_web: true,
      }),
    ).rejects.toThrow('invalid_input');
  });
  it('does not expose malformed historical model values as JSON', async () => {
    const f = fixture();
    (
      (f.provider.fields as NodiaAiJsonObject).agentic as NodiaAiJsonObject
    ).selected_model = { token: 'PRIVATE_HISTORICAL' };
    const { step } = await f.ready('ai_providers', 'update', {
      id: '30',
      'agentic.selected_model': 'model-b',
    });
    expect(JSON.stringify(step)).not.toContain('PRIVATE_HISTORICAL');
    expect(JSON.stringify(step)).not.toContain('MUST_NOT_LEAK');
  });
  it('preserves explicit null default mode when disabling its previous channel', async () => {
    const f = fixture(),
      { step, port } = await f.ready('ai_providers', 'update', {
        id: '30',
        default_mode: null,
        use_agentic: false,
      });
    expect(
      (step.preconditions.effective as NodiaAiJsonObject).default_mode,
    ).toBeNull();
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[1].execute.mock.calls[0][1]).toEqual({
      default_mode: null,
      use_agentic: false,
    });
  });
  it('previews native translation upsert with existing keys preserved', async () => {
    const f = fixture(),
      { step, port } = await f.ready('ai_providers', 'update', {
        id: '30',
        translates: [{ key: 'description', es: 'Detalle', en: 'Detail' }],
      });
    expect(
      (step.commandTemplate.command as NodiaAiJsonObject).translates,
    ).toEqual([
      { key: 'description', es: 'Detalle', en: 'Detail' },
      f.translations[0],
    ]);
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[1].execute.mock.calls[0][1]).toEqual({
      translates: (step.commandTemplate.command as NodiaAiJsonObject)
        .translates,
    });
  });
  it('rejects apparent translation deletion unsupported by the native endpoint', async () => {
    const f = fixture();
    await expect(
      f.ready('ai_providers', 'update', { id: '30', translates: [] }),
    ).rejects.toThrow('translation_removal_unsupported');
    const { port, step } = await f.ready('ai_providers', 'update', {
      id: '30',
      translates: f.translations,
    });
    await expect(
      port.applyEdits(
        step.commandTemplate,
        [{ step_id: session, field_key: 'translates', value: [] }],
        f.ctx,
      ),
    ).rejects.toThrow('translation_removal_unsupported');
  });
  for (const value of [true, false])
    it(`projects the actual historical Web boolean ${value} without inferring availability`, async () => {
      const f = fixture();
      (
        (f.provider.fields as NodiaAiJsonObject).agentic as NodiaAiJsonObject
      ).enable_extended_thinking = value;
      const { step } = await f.ready('ai_providers', 'update', {
        id: '30',
        'agentic.selected_model': 'model-b',
      });
      expect(
        (step.preconditions.configuration_status as NodiaAiJsonObject)
          .reasoning_preferences,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ legacy_boolean: value }),
        ]),
      );
      const modelConfig = step.preconditions
        .model_configuration as NodiaAiJsonObject;
      expect(modelConfig.agentic).toMatchObject({
        legacy_boolean: value,
      });
    });
  it('keeps an explicitly unassigned default mode in preview and execution', async () => {
    const f = fixture(),
      { step, port } = await f.ready('ai_providers', 'create', {
        catalog_id: '20',
        use_agentic: true,
        default_mode: null,
      });
    expect(
      (step.commandTemplate.command as NodiaAiJsonObject).default_mode,
    ).toBeNull();
    expect(
      (step.commandTemplate.origins as NodiaAiJsonObject).default_mode,
    ).toBe('user');
    expect(step.publicStep.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field_key: 'default_mode',
          after: null,
          origin: 'user',
        }),
      ]),
    );
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[0].execute.mock.calls[0][0]).toMatchObject({
      default_mode: null,
    });
  });
});
