import { describe, it, expect, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { BuildNodiaAiSecureOperationsUseCase } from './build-nodia-ai-secure-operations.use-case.js';
import { NodiaAiSecurePreparationService } from '../nodia-ai-secure-preparation.service.js';

/** Entirely synthetic key metadata; never a credential or native account. */
function fixture() {
  const authority = { module: true, action: false };
  const provider: NodiaAiJsonObject = {
    id: '2',
    name: 'Synthetic connection',
    provider_key: 'gemini',
    is_active: true,
    catalog_active: true,
    use_api_key: true,
    use_agentic: true,
    can_use_api_key: true,
    can_use_agentic: true,
  };
  const pool: NodiaAiJsonObject[] = [];
  const store = {
    provider: vi.fn(async () => structuredClone(provider)),
    keys: vi.fn(async () => structuredClone(pool)),
  } as unknown as NodiaAiSecurePreparationService;
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('AS "actorId"'))
      return [
        {
          actorId: '1',
          sessionId: '00000000-0000-4000-8000-000000000001',
          isSuperAdmin: false,
        },
      ];
    if (sql.includes(' AS module')) return [{ ...authority }];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const context: ProposalPreparerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '00000000-0000-4000-8000-000000000001',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/nodia-ai', '/ai-providers'],
    conversationId: '00000000-0000-4000-8000-000000000002',
  };
  const operations = new BuildNodiaAiSecureOperationsUseCase(store).operations;
  const port = (kind: string) => operations.find((p) => p.kind === kind)!;
  async function ready(kind: string, input: NodiaAiJsonObject) {
    const p = port(kind),
      r = await p.prepare(input, context);
    if (r.status !== 'ready') throw new Error('fixture expected ready');
    const step: StoredProposalStep = {
      id: '00000000-0000-4000-8000-000000000003',
      toolName: p.toolName,
      contractHash: p.contractHash,
      position: 1,
      outputBindings: [],
      ...r,
    };
    return { p, r, step };
  }
  return {
    authority,
    provider,
    pool,
    store,
    query,
    manager,
    context,
    operations,
    port,
    ready,
  };
}
describe('BuildNodiaAiSecureOperationsUseCase', () => {
  it('keeps the retired logout reader outside all live preparation and rechecks read authority without rewriting its command', async () => {
    const f = fixture();
    const builder = new BuildNodiaAiSecureOperationsUseCase(f.store);
    const reader = builder.historicalReaders[0];
    expect(builder.operations.some((p) => p.toolName === reader.toolName)).toBe(
      false,
    );
    const { step } = await f.ready('sync_models', {
      provider_id: '2',
      mode: 'agentic',
    });
    step.toolName = reader.toolName;
    step.contractHash = 'b'.repeat(64);
    const bytes = JSON.stringify(step);
    await expect(
      reader.verifyHistoricalReadAuthority!(step, f.context),
    ).resolves.toBeUndefined();
    expect(JSON.stringify(step)).toBe(bytes);
    await expect(
      reader.prepare({ provider_id: '2' }, f.context),
    ).rejects.toThrow('mode_retired');
    f.authority.module = false;
    await expect(
      reader.verifyHistoricalReadAuthority!(step, f.context),
    ).rejects.toThrow('capability_denied');
  });
  it('registers seven opaque human flows without executable SQL/model output ports', () => {
    const f = fixture();
    expect(f.operations).toHaveLength(7);
    for (const p of f.operations) {
      expect(p.contractHash).toMatch(/^[a-f0-9]{64}$/);
      expect(p.bindableFields).toEqual({});
      expect(p.outputKeys).toEqual({});
      expect(p).not.toHaveProperty('executeConfirmed');
    }
  });
  it.each([
    'secret',
    'api_key',
    'cookie',
    'password',
    'authorization',
    'native_reference',
    'session_id',
    'url',
    'command',
    'schema_version',
    'origins',
    'health_state',
    'last_error_message',
  ])('rejects model input %s before any data lookup', async (key) => {
    const f = fixture();
    await expect(
      f
        .port('api_key_create')
        .prepare(
          { provider_id: '2', label: 'x', [key]: 'synthetic-rejected' },
          f.context,
        ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.store.provider).not.toHaveBeenCalled();
  });
  it('asks only for nonsecret missing fields', async () => {
    const f = fixture(),
      r = await f.port('api_key_create').prepare({}, f.context);
    expect(r.status).toBe('needs_clarification');
    if (r.status === 'needs_clarification')
      expect(r.missingFields).toEqual(['provider_id', 'label']);
    expect(JSON.stringify(r)).not.toContain('secret');
  });
  it('freezes native first active key selection and metadata defaults deterministically', async () => {
    const f = fixture(),
      { p, r } = await f.ready('api_key_create', {
        provider_id: '2',
        label: 'New',
      });
    expect(r.commandTemplate.command).toEqual({
      label: 'New',
      sort_order: 0,
      is_active: true,
      is_selected: true,
    });
    expect(await p.reprepareStored(r.commandTemplate, f.context)).toEqual(r);
    expect(r.publicStep.kind).toBe('secure_flow');
    expect(r.scope).toEqual({});
  });
  it('allows configuring a key before enabling the API channel', async () => {
    const f = fixture();
    f.provider.use_api_key = false;
    expect(
      (await f.ready('api_key_create', { provider_id: '2', label: 'New' })).r
        .status,
    ).toBe('ready');
  });
  it('does not select an inactive new key', async () => {
    const f = fixture(),
      { r } = await f.ready('api_key_create', {
        provider_id: '2',
        label: 'New',
        is_active: false,
      });
    expect(r.commandTemplate.command).toMatchObject({
      is_active: false,
      is_selected: false,
    });
  });
  it('rejects selected inactive key', async () => {
    const f = fixture();
    await expect(
      f.ready('api_key_create', {
        provider_id: '2',
        label: 'New',
        is_active: false,
        is_selected: true,
      }),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it.each(['9223372036854775808', '0', '-1', '2.5', 2])(
    'rejects invalid provider id %s',
    async (id) => {
      const f = fixture();
      await expect(
        f
          .port('connection_login')
          .prepare({ provider_id: id, mode: 'agentic' }, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
    },
  );
  it.each([
    { sort_order: -1 },
    { sort_order: 1000001 },
    { sort_order: 0.2 },
    { label: '' },
    { label: ' '.repeat(10) },
    { is_selected: null },
    { is_active: 'true' },
  ])('rejects invalid metadata %j', async (command) => {
    const f = fixture();
    await expect(
      f
        .port('api_key_update')
        .prepare(
          { provider_id: '2', key_id: '3', ...command } as NodiaAiJsonObject,
          f.context,
        ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('rejects a key from another connection', async () => {
    const f = fixture();
    await expect(
      f.ready('api_key_delete', { provider_id: '2', key_id: '5' }),
    ).rejects.toThrow('nodia_ai:domain_target_not_found');
  });
  it('normalizes selection and freezes the same pool across a concurrent native deletion', async () => {
    const f = fixture();
    const existing = {
      id: '3',
      provider_id: '2',
      label: 'Existing',
      sort_order: 0,
      is_active: true,
      is_selected: true,
      updated_at: 'one',
    };
    vi.mocked(f.store.keys)
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([]);
    const { p, r, step } = await f.ready('api_key_create', {
      provider_id: '2',
      label: 'New',
    });
    expect(f.store.keys).toHaveBeenCalledTimes(1);
    expect(r.commandTemplate.command).toMatchObject({ is_selected: false });
    expect(r.preconditions.key_pool).toEqual([existing]);
    await expect(p.verifyPreconditions(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
  });
  it('invalidates exact approval when a key rotates or selection pool changes', async () => {
    const f = fixture();
    f.pool.push({
      id: '3',
      provider_id: '2',
      label: 'Old',
      sort_order: 0,
      is_selected: true,
      is_active: true,
      updated_at: 'one',
    });
    const { p, step } = await f.ready('api_key_update', {
      provider_id: '2',
      key_id: '3',
    });
    f.pool[0].updated_at = 'two';
    await expect(p.verifyPreconditions(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
  });
  it('previews deletion with the remaining single active key selected', async () => {
    const f = fixture();
    f.pool.push(
      { id: '3', label: 'A', is_active: true, is_selected: true },
      { id: '4', label: 'B', is_active: true, is_selected: false },
    );
    const { r } = await f.ready('api_key_delete', {
      provider_id: '2',
      key_id: '3',
    });
    expect(JSON.stringify(r.publicStep)).toContain('key_selection_impact');
    expect(r.publicStep.target).toEqual({
      resource_key: 'ai_api_keys',
      id: '3',
      label: 'A',
    });
  });
  it.each([
    ['gemini', 'api_key'],
    ['openai', 'api_key'],
    ['other', 'agentic'],
  ])('rejects unsupported login %s/%s', async (provider, mode) => {
    const f = fixture();
    f.provider.provider_key = provider;
    await expect(
      f.ready('connection_login', { provider_id: '2', mode }),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('requires enabled target mode but never infers authenticated availability', async () => {
    const f = fixture();
    f.provider.use_agentic = false;
    await expect(
      f.ready('connection_login', { provider_id: '2', mode: 'agentic' }),
    ).rejects.toThrow('nodia_ai:capability_unavailable');
    f.provider.use_agentic = true;
    const { r } = await f.ready('connection_login', {
      provider_id: '2',
      mode: 'agentic',
    });
    expect(r.preconditions.provider_key).toBe('gemini');
    expect(r.preconditions).not.toHaveProperty('authenticated');
  });
  it('binds own logout to authenticated context without exposing a session id', async () => {
    const f = fixture(),
      { p, r, step } = await f.ready('nodia_logout', {});
    expect(p.moduleRoutes).toEqual([]);
    expect(p.actionKeys).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(f.context.actor.sessionId);
    await p.verifyPreconditions(step, f.context);
    expect(f.store.provider).not.toHaveBeenCalled();
  });
  it('permits missing role actions and revalidates current module authority', async () => {
    const f = fixture(),
      { p, step } = await f.ready('connection_login', {
        provider_id: '2',
        mode: 'agentic',
      });
    await expect(p.verifyAuthority(step, f.context)).resolves.toBeUndefined();
    f.authority.module = false;
    await expect(p.verifyAuthority(step, f.context)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
    f.authority.module = true;
    f.context.moduleRoutes = [];
    await expect(p.verifyAuthority(step, f.context)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
  });
  it('rejects metadata edits that smuggle secrets and preserves a valid correction', async () => {
    const f = fixture(),
      { p, r } = await f.ready('api_key_create', {
        provider_id: '2',
        label: 'New',
      });
    await expect(
      p.applyEdits(
        r.commandTemplate,
        [{ step_id: 'x', field_key: 'secret', value: 'synthetic-rejected' }],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const next = await p.applyEdits(
      r.commandTemplate,
      [{ step_id: 'x', field_key: 'label', value: 'Corrected' }],
      f.context,
    );
    expect(next.command).toMatchObject({ label: 'Corrected' });
  });
  it('rejects transaction-free preparation', async () => {
    const f = fixture();
    Object.assign(f.manager.queryRunner!, { isTransactionActive: false });
    await expect(f.ready('nodia_logout', {})).rejects.toThrow(
      'authorization:transaction_required',
    );
  });
});
