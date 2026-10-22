import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiExecutionGrant } from '../../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import type { NodiaAiClaim } from '../../nodia-ai-runtime/types/worker.types.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { LoadNodiaAiKnowledgeUseCase } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { knowledgeHash } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import type { NodiaAiRegisteredTool } from '../types/tool-registry.types.js';
import { nodiaAiToolSelectionState } from '../types/tool-selection.types.js';
import type { NodiaAiToolRegistryUseCase } from './nodia-ai-tool-registry.use-case.js';
import type { DiscoverNodiaAiToolsUseCase } from './discover-nodia-ai-tools.use-case.js';
import {
  SelectNodiaAiTurnToolsUseCase,
  loadNodiaAiToolSelectionProfiles,
} from './select-nodia-ai-turn-tools.use-case.js';
import {
  NodiaAiToolSelectionFlowUseCase,
  NODIA_AI_SELECT_CAPABILITIES_TOOL,
} from './nodia-ai-tool-selection-flow.use-case.js';

const schema = { type: 'object', additionalProperties: false, properties: {} };
function fixture() {
  const id = 'nodia_synthetic_read';
  const tool = {
    capabilityId: id,
    toolName: id,
    contractHash: knowledgeHash(id),
    kind: 'read',
    description: 'Synthetic selected operation.',
    moduleKey: 'synthetic_module',
    resourceKey: 'synthetic_resource',
    inputSchema: schema,
  } as unknown as NodiaAiRegisteredTool;
  const actor = {
    actorId: '1',
    sessionId: randomUUID(),
    isSuperAdmin: false,
    modules: [{ id: '1', key: 'nodia_ai', route: '/tools/nodia-ai' }],
  };
  const tools = [tool];
  const discovery = {
    registeredCatalog: () => tools,
    published: (_tool: NodiaAiRegisteredTool) => true,
    visible: vi.fn(async () => tools),
    descriptors: () =>
      loadNodiaAiToolSelectionProfiles()
        .technical_tool_names.filter(
          (name) =>
            !['nodia_knowledge_get', 'nodia_knowledge_index'].includes(name),
        )
        .map((name) => ({
          name,
          description: 'Synthetic technical descriptor.',
          inputSchema: schema,
        })),
    contractHash: (name: string) => knowledgeHash(name),
  };
  const registry = { catalogVersion: 'synthetic/1' };
  const knowledge = {
    manifest: { capability_contracts: [{ capability_id: id }] },
  };
  const authorize = { execute: vi.fn(async () => actor) };
  const flow = new NodiaAiToolSelectionFlowUseCase(
    registry as NodiaAiToolRegistryUseCase,
    knowledge as LoadNodiaAiKnowledgeUseCase,
    discovery as unknown as DiscoverNodiaAiToolsUseCase,
    new SelectNodiaAiTurnToolsUseCase(),
    authorize as unknown as AuthorizeNodiaAiUseCase,
  );
  const selection = {
    connection_id: '2',
    mode: 'token_plan_agentic',
    model_id: 'synthetic-model',
    effort_id: null,
  };
  const run: NodiaAiRun = Object.assign(new NodiaAiRun(), {
    id: randomUUID(),
    conversation_id: randomUUID(),
    actor_id: '1',
    selection_snapshot: selection,
    routing_snapshot: { enabled: false },
    context_manifest: {
      module_routes: ['/tools/nodia-ai'],
      tool_selection: {
        schema_version: 1,
        phase: 'discovery',
        catalog_hash: flow.catalogHash(),
      },
      tool_contracts: {},
    },
  });
  const grant: NodiaAiExecutionGrant = Object.assign(
    new NodiaAiExecutionGrant(),
    {
      run_id: run.id,
      allowed_modules: ['/tools/nodia-ai'],
      allowed_operations: ['chat:respond', NODIA_AI_SELECT_CAPABILITIES_TOOL],
      actor_id: actor.actorId,
      session_public_id: actor.sessionId,
      revoked_at: null,
      expires_at: new Date(Date.now() + 60000),
    },
  );
  run.context_manifest.tool_contracts = {
    [NODIA_AI_SELECT_CAPABILITIES_TOOL]: flow.contractHash(),
  };
  const attempt: NodiaAiJobAttempt = Object.assign(new NodiaAiJobAttempt(), {
    id: randomUUID(),
    job_id: randomUUID(),
    phase: 'dispatch_armed',
    stage_key: 'inference',
    ended_at: null,
    routing_phase: 'base',
    selection_snapshot: selection,
  });
  const receipts: NodiaAiToolCall[] = [];
  const receiptRepo = {
    findOneBy: vi.fn(
      async (where: Partial<NodiaAiToolCall>) =>
        receipts.find((row) =>
          Object.entries(where).every(
            ([key, value]) => row[key as keyof NodiaAiToolCall] === value,
          ),
        ) ?? null,
    ),
    save: vi.fn(async (row: NodiaAiToolCall) => {
      receipts.push(row);
      return row;
    }),
  };
  const runRepo = {
    findOneByOrFail: vi.fn(async () => run),
    save: vi.fn(async () => run),
  };
  const grantRepo = {
    findOneByOrFail: vi.fn(async () => grant),
    save: vi.fn(async () => grant),
  };
  const attemptsRepo = {
    findOneBy: vi.fn(async ({ id: selectedId }: { id: string }) =>
      selectedId === attempt.id ? attempt : null,
    ),
  };
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async () => []),
    getRepository: (entity: unknown) =>
      entity === NodiaAiRun
        ? runRepo
        : entity === NodiaAiToolCall
          ? receiptRepo
          : entity === NodiaAiExecutionGrant
            ? grantRepo
            : entity === NodiaAiJobAttempt
              ? attemptsRepo
              : undefined,
  } as unknown as EntityManager;
  const claim = {
    run,
    attempt,
    job: { id: attempt.job_id },
    identity: { userId: '1', sessionId: actor.sessionId },
  } as unknown as NodiaAiClaim;
  const call = {
    callId: 'synthetic-select-call',
    name: NODIA_AI_SELECT_CAPABILITIES_TOOL,
    arguments: { catalog_version: 'synthetic/1', capability_ids: [id] },
  };
  const request = () =>
    flow.requestSelection(manager, claim, actor, ['/tools/nodia-ai'], call);
  const pendingAck = async () => {
    await request();
    const state = nodiaAiToolSelectionState(
      run.context_manifest.tool_selection,
    )!;
    run.context_manifest.tool_selection = {
      ...state,
      phase: 'ack_pending',
    } as unknown as typeof run.context_manifest;
    attempt.phase = 'completed';
    attempt.ended_at = new Date();
  };
  return {
    flow,
    id,
    tool,
    tools,
    actor,
    discovery,
    run,
    grant,
    attempt,
    receipts,
    receiptRepo,
    runRepo,
    grantRepo,
    authorize,
    manager,
    claim,
    call,
    request,
    pendingAck,
  };
}

describe('NodiaAiToolSelectionFlowUseCase', () => {
  it('stores an exact durable selection without widening the current generation grant', async () => {
    const f = fixture();
    const grantBefore = [...f.grant.allowed_operations];
    const result = await f.request();
    expect(result).toEqual({
      status: 'selection_requested',
      selected_capability_ids: [f.id],
      next_action: 'finish_current_generation',
      business_effects: false,
    });
    expect(f.grant.allowed_operations).toEqual(grantBefore);
    expect(f.grantRepo.save).not.toHaveBeenCalled();
    expect(f.receipts).toHaveLength(1);
    const state = nodiaAiToolSelectionState(
      f.run.context_manifest.tool_selection,
    )!;
    expect(state.phase).toBe('selection_requested');
    expect(state.request?.attempt_id).toBe(f.attempt.id);
    expect(state.request?.tool_call_id).toBe(f.receipts[0].id);
    expect(Object.keys(state.request!.tool_contracts)).toHaveLength(8);
  });
  it('returns the same authorized receipt on exact callback replay without another selection', async () => {
    const f = fixture();
    expect(await f.request()).toEqual(await f.request());
    expect(f.receipts).toHaveLength(1);
    expect(f.runRepo.save).toHaveBeenCalledOnce();
  });
  it.each(['status', 'extra', 'ids', 'effects'] as const)(
    'rejects a corrupted selection replay result: %s',
    async (variant) => {
      const f = fixture();
      await f.request();
      if (variant === 'status')
        f.receipts[0].public_result!.status = 'completed';
      if (variant === 'extra')
        f.receipts[0].public_result!.secret = 'synthetic';
      if (variant === 'ids')
        f.receipts[0].public_result!.selected_capability_ids = ['invented'];
      if (variant === 'effects')
        f.receipts[0].public_result!.business_effects = true;
      await expect(f.request()).rejects.toThrow('request_conflict');
      expect(f.receipts).toHaveLength(1);
    },
  );
  it('rejects another call identity even when it requests the same tools', async () => {
    const f = fixture();
    await f.request();
    f.call.callId = 'another-call';
    await expect(f.request()).rejects.toThrow('request_conflict');
    expect(f.receipts).toHaveLength(1);
  });
  it.each([
    { ids: [] },
    { ids: ['unpublished'] },
    { ids: ['nodia_synthetic_read', 'nodia_synthetic_read'] },
  ])('rejects empty/unknown/duplicate selection %j', async ({ ids }) => {
    const f = fixture();
    f.call.arguments.capability_ids = ids;
    await expect(f.request()).rejects.toThrow();
    expect(f.receipts).toHaveLength(0);
  });
  it('rejects fields that try to choose actor, credentials or a new model', async () => {
    const f = fixture();
    Object.assign(f.call.arguments, {
      actor_id: '2',
      model_id: 'invented',
      secret: 'synthetic',
    });
    await expect(f.request()).rejects.toThrow('invalid_tool_input');
    expect(f.receipts).toHaveLength(0);
  });
  it('reauthorizes a replay and never returns a receipt after a module is revoked', async () => {
    const f = fixture();
    await f.request();
    f.discovery.visible.mockResolvedValue([]);
    await expect(f.request()).rejects.toThrow('capability_denied');
    expect(f.receipts).toHaveLength(1);
  });
  it.each(['claimed', 'ended', 'different_model', 'different_job'] as const)(
    'rejects a nonmatching active attempt: %s',
    async (variant) => {
      const f = fixture();
      if (variant === 'claimed') f.attempt.phase = 'claimed';
      if (variant === 'ended') f.attempt.ended_at = new Date();
      if (variant === 'different_model')
        f.attempt.selection_snapshot = {
          ...f.attempt.selection_snapshot!,
          model_id: 'another-model',
        };
      if (variant === 'different_job') f.claim.job.id = randomUUID();
      await expect(f.request()).rejects.toThrow('capability_denied');
      expect(f.receipts).toHaveLength(0);
    },
  );
  it('requires terminal closure and acknowledged native proof before activating a grant', async () => {
    const f = fixture();
    await f.request();
    await expect(f.flow.activateSelection(f.manager, f.claim)).rejects.toThrow(
      'catalog_changed',
    );
    expect(f.grantRepo.save).not.toHaveBeenCalled();
    const state = nodiaAiToolSelectionState(
      f.run.context_manifest.tool_selection,
    )!;
    f.run.context_manifest.tool_selection = {
      ...state,
      phase: 'ack_pending',
    } as unknown as typeof f.run.context_manifest;
    await expect(f.flow.activateSelection(f.manager, f.claim)).rejects.toThrow(
      'tool_selection_ack_pending',
    );
    expect(f.grantRepo.save).not.toHaveBeenCalled();
  });
  it('activates only the exact selected tools plus seven technical helpers after proof/ACK', async () => {
    const f = fixture();
    await f.pendingAck();
    await f.flow.activateSelection(f.manager, f.claim);
    expect(f.grant.allowed_operations).toHaveLength(9);
    expect(f.grant.allowed_operations).toContain(f.id);
    expect(f.grant.allowed_operations).not.toContain(
      NODIA_AI_SELECT_CAPABILITIES_TOOL,
    );
    expect(f.grantRepo.save).toHaveBeenCalledOnce();
    expect(
      nodiaAiToolSelectionState(f.run.context_manifest.tool_selection)?.phase,
    ).toBe('execution');
    expect(f.run.context_manifest.tool_contracts).toHaveProperty(
      f.id,
      f.tool.contractHash,
    );
  });
  it('preflights a selection without changing the grant or context and revalidates on activation', async () => {
    const f = fixture();
    await f.pendingAck();
    f.runRepo.save.mockClear();
    await f.flow.verifySelection(f.manager, f.claim);
    expect(f.runRepo.save).not.toHaveBeenCalled();
    expect(f.grantRepo.save).not.toHaveBeenCalled();
    expect(
      nodiaAiToolSelectionState(f.run.context_manifest.tool_selection)?.phase,
    ).toBe('ack_pending');
    f.discovery.visible.mockResolvedValue([]);
    await expect(f.flow.activateSelection(f.manager, f.claim)).rejects.toThrow(
      'capability_denied',
    );
    expect(f.grantRepo.save).not.toHaveBeenCalled();
  });
  it.each([
    'receipt_ids',
    'receipt_hash',
    'receipt_scope',
    'receipt_result',
    'prior_model',
    'pending_ack',
    'authority',
  ] as const)(
    'refuses an inconsistent or unacknowledged continuation: %s',
    async (variant) => {
      const f = fixture();
      await f.pendingAck();
      if (variant === 'receipt_ids')
        f.receipts[0].arguments.capability_ids = ['unpublished'];
      if (variant === 'receipt_hash')
        f.receipts[0].arguments_hash = '0'.repeat(64);
      if (variant === 'receipt_scope')
        f.receipts[0].scope_manifest.authority_hash = '0'.repeat(64);
      if (variant === 'receipt_result')
        f.receipts[0].public_result!.selected_capability_ids = ['unpublished'];
      if (variant === 'prior_model')
        f.attempt.selection_snapshot = {
          ...f.attempt.selection_snapshot!,
          model_id: 'another-model',
        };
      if (variant === 'pending_ack')
        vi.mocked(f.manager.query).mockResolvedValue([{ id: randomUUID() }]);
      if (variant === 'authority') f.discovery.visible.mockResolvedValue([]);
      await expect(
        f.flow.activateSelection(f.manager, f.claim),
      ).rejects.toThrow();
      expect(f.grantRepo.save).not.toHaveBeenCalled();
    },
  );
});

describe('complete authorized discovery index', () => {
  const refresh = (f: ReturnType<typeof fixture>) => {
    const state = nodiaAiToolSelectionState(
      f.run.context_manifest.tool_selection,
    )!;
    f.run.context_manifest.tool_selection = {
      ...state,
      catalog_hash: f.flow.catalogHash(),
    } as unknown as NodiaAiRun['context_manifest'];
  };
  it('projects exact capability IDs independently of tool names without schemas or business calls', async () => {
    const f = fixture();
    f.tools[0] = { ...f.tool, toolName: 'nodia_different_tool_name' };
    refresh(f);
    const before = [...f.grant.allowed_operations];
    const index = await f.flow.discoveryIndex(f.manager, f.claim);
    expect(index).toEqual({
      schema_version: 1,
      catalog_version: 'synthetic/1',
      catalog_hash: f.flow.catalogHash(),
      selection_required: true,
      modules: [
        {
          module_key: 'synthetic_module',
          resources: [
            {
              resource_key: 'synthetic_resource',
              capabilities: [
                {
                  capability_id: f.id,
                  tool_name: 'nodia_different_tool_name',
                  kind: 'read',
                  description: f.tool.description,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(f.grant.allowed_operations).toEqual(before);
    expect(f.runRepo.save).not.toHaveBeenCalled();
    expect(f.grantRepo.save).not.toHaveBeenCalled();
    expect(f.receiptRepo.save).not.toHaveBeenCalled();
    expect(JSON.stringify(index)).not.toContain('inputSchema');
    expect(f.discovery.visible).toHaveBeenCalledWith(f.manager, f.actor, [
      '/tools/nodia-ai',
    ]);
  });
  it('groups a complete 151-capability catalog without a collection larger than 128 or a truncated prefix', async () => {
    const f = fixture();
    f.tools.splice(
      0,
      f.tools.length,
      ...Array.from({ length: 151 }, (_, position) => ({
        ...f.tool,
        capabilityId: `synthetic_cap_${position.toString().padStart(3, '0')}`,
        toolName: `synthetic_tool_${position}`,
        resourceKey: `resource_${Math.floor(position / 100)}`,
      })),
    );
    refresh(f);
    const index = await f.flow.discoveryIndex(f.manager, f.claim);
    const modules = index!.modules as {
      resources: { capabilities: unknown[] }[];
    }[];
    expect(
      modules
        .flatMap((module) => module.resources)
        .flatMap((resource) => resource.capabilities),
    ).toHaveLength(151);
    const check = (value: unknown) => {
      if (value && typeof value === 'object') {
        expect(Object.values(value).length).toBeLessThanOrEqual(128);
        Object.values(value).forEach(check);
      }
    };
    check(index);
  });
  it.each(['modules', 'resources', 'capabilities'] as const)(
    'rejects an unbounded %s group instead of silently omitting metadata',
    async (group) => {
      const f = fixture();
      f.tools.splice(
        0,
        f.tools.length,
        ...Array.from({ length: 129 }, (_, position) => ({
          ...f.tool,
          capabilityId: `synthetic_cap_${position}`,
          toolName: `synthetic_tool_${position}`,
          moduleKey: group === 'modules' ? `module_${position}` : 'module',
          resourceKey:
            group === 'resources' ? `resource_${position}` : 'resource',
        })),
      );
      refresh(f);
      await expect(f.flow.discoveryIndex(f.manager, f.claim)).rejects.toThrow(
        'context_limit',
      );
    },
  );
  it('uses only published metadata visible under the current frozen module intersection', async () => {
    const f = fixture();
    const unpublished = {
      ...f.tool,
      capabilityId: 'synthetic_unpublished',
      toolName: 'synthetic_unpublished_tool',
    };
    f.tools.push(unpublished);
    vi.spyOn(f.discovery, 'published').mockImplementation(
      (item) => item.capabilityId !== unpublished.capabilityId,
    );
    f.actor.modules.push({ id: '2', key: 'new', route: '/tools/new' });
    refresh(f);
    const index = await f.flow.discoveryIndex(f.manager, f.claim);
    expect(JSON.stringify(index)).not.toContain(unpublished.capabilityId);
    expect(f.discovery.visible).toHaveBeenCalledWith(f.manager, f.actor, [
      '/tools/nodia-ai',
    ]);
    f.discovery.visible.mockResolvedValue([]);
    expect((await f.flow.discoveryIndex(f.manager, f.claim))!.modules).toEqual(
      [],
    );
  });
  it.each(['grant', 'actor', 'session', 'expired', 'catalog'] as const)(
    'refuses stale discovery authority: %s',
    async (change) => {
      const f = fixture();
      if (change === 'grant') f.grant.revoked_at = new Date();
      if (change === 'actor') f.grant.actor_id = 'another-actor';
      if (change === 'session') f.grant.session_public_id = randomUUID();
      if (change === 'expired') f.grant.expires_at = new Date(0);
      if (change === 'catalog')
        f.tools[0] = { ...f.tool, contractHash: 'a'.repeat(64) };
      await expect(f.flow.discoveryIndex(f.manager, f.claim)).rejects.toThrow(
        'catalog_changed',
      );
      expect(f.discovery.visible).not.toHaveBeenCalled();
    },
  );
  it('propagates a live session revocation instead of returning cached metadata', async () => {
    const f = fixture();
    f.authorize.execute.mockRejectedValueOnce(new Error('session-revoked'));
    await expect(f.flow.discoveryIndex(f.manager, f.claim)).rejects.toThrow(
      'session-revoked',
    );
  });
  it('omits discovery data in Web and execution without consulting the catalog or granting tools', async () => {
    const f = fixture();
    f.run.selection_snapshot.mode = 'token_plan_web';
    expect(await f.flow.discoveryIndex(f.manager, f.claim)).toBeUndefined();
    f.run.selection_snapshot.mode = 'token_plan_agentic';
    f.run.context_manifest.tool_selection = {
      schema_version: 1,
      phase: 'execution',
      catalog_hash: f.flow.catalogHash(),
    };
    expect(await f.flow.discoveryIndex(f.manager, f.claim)).toBeUndefined();
    expect(f.authorize.execute).not.toHaveBeenCalled();
    expect(f.discovery.visible).not.toHaveBeenCalled();
  });
});

describe('strict persisted tool selection state', () => {
  it.each([
    'extra',
    'missing_request',
    'request_extra',
    'bad_uuid',
    'duplicate_ids',
    'unknown_profile',
    'missing_contract',
    'bad_hash',
  ] as const)('rejects malformed backend metadata: %s', async (variant) => {
    const f = fixture();
    await f.request();
    const state = JSON.parse(
      JSON.stringify(f.run.context_manifest.tool_selection),
    );
    if (variant === 'extra') state.actor_id = '2';
    if (variant === 'missing_request') delete state.request;
    if (variant === 'request_extra') state.request.secret = 'synthetic';
    if (variant === 'bad_uuid') state.request.attempt_id = 'invalid';
    if (variant === 'duplicate_ids') state.request.capability_ids.push(f.id);
    if (variant === 'unknown_profile')
      state.request.profile.profile_id = 'invented';
    if (variant === 'missing_contract')
      delete state.request.tool_contracts[f.id];
    if (variant === 'bad_hash') state.request.tool_contracts[f.id] = 'invalid';
    expect(nodiaAiToolSelectionState(state)).toBeUndefined();
  });
});
