import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { readFileSync } from 'node:fs';
import { PrepareNodiaAiAdmissionUseCase } from './prepare-nodia-ai-admission.use-case.js';
import type { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { LoadNodiaAiKnowledgeUseCase } from './load-nodia-ai-knowledge.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import type {
  NodiaAiConversationSummary,
  NodiaAiSelection,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import {
  DiscoverNodiaAiToolsUseCase,
  NODIA_AI_COMMON_TOOL_NAMES,
} from '../../nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.js';
import type { SelectNodiaAiTurnToolsUseCase } from '../../nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case.js';
import type { NodiaAiSelectTurnToolsInput } from '../../nodia-ai-tools/types/tool-selection.types.js';
import { isNodiaAiMcpExecutableRegistration } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiRegisteredTool } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiToolSelectionFlowUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';

const now = new Date('2026-10-15T15:00:00Z');
const identity = {
  userId: '1',
  sessionId: '5a18024c-e748-493d-8bed-9d0431b915bc',
};
const selection: NodiaAiSelection = {
  connection_id: '2',
  mode: 'token_plan_web',
  model_id: 'fixture-model',
  effort_id: null,
};
function fixture() {
  const policy = JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as NodiaAiRuntimePolicy;
  const eligibility = {
    available: true,
    observedAt: now,
    resourceKey: 'gemini-profile:' + '1'.repeat(64),
    configurationGeneration: '2'.repeat(64),
    sessionGeneration: '3'.repeat(32),
    supportsMcp: false,
  };
  const adapter = {
    observe: vi.fn().mockResolvedValue(eligibility),
    verifyConfiguration: vi.fn().mockResolvedValue(undefined),
  };
  const knowledge = {
    manifest: {
      release_id: 'release',
      catalog_release: 'catalog',
      capability_contracts: [],
    },
    execute: vi.fn().mockReturnValue({
      releaseId: 'release',
      catalogVersion: 'catalog',
      fragments: [],
    }),
  };
  const tools = {
    descriptors: vi.fn(() =>
      NODIA_AI_COMMON_TOOL_NAMES.map((name) => ({ name })),
    ),
    contractHash: vi.fn(() => '4'.repeat(64)),
    visible: vi.fn().mockResolvedValue([]),
    registeredCatalog: vi.fn(() => [] as NodiaAiRegisteredTool[]),
  };
  const selectionFlow = {
    descriptor: () => ({ name: 'nodia_capabilities_select' }),
    contractHash: () => 'c'.repeat(64),
    catalogHash: () => 'd'.repeat(64),
  };
  // These tests focus on admission identity/eligibility. Explicit deployment
  // profiles and catalog byte limits are exercised by the real selector suite.
  const selector = {
    execute: vi.fn((input: NodiaAiSelectTurnToolsInput) => {
      const selected = input.registeredTools.filter(
        (tool) =>
          input.authorizedToolNames.includes(tool.toolName) &&
          isNodiaAiMcpExecutableRegistration(tool),
      );
      return {
        profile: {
          schema_version: 1,
          profile_id: input.profileId ?? 'published_reads',
          revision: 1,
          sha256: 'b'.repeat(64),
        },
        capabilityIds: selected.map((tool) => tool.capabilityId),
        toolContracts: Object.fromEntries([
          ...input.technicalTools.map((item) => [
            item.descriptor.name,
            item.contractHash,
          ]),
          ...selected.map((tool) => [tool.toolName, tool.contractHash]),
        ]),
        descriptors: [],
        catalogUtf8Bytes: 0,
      };
    }),
  };
  const subject = new PrepareNodiaAiAdmissionUseCase(
    adapter as unknown as NodiaAiAdapterPort,
    knowledge as unknown as LoadNodiaAiKnowledgeUseCase,
    policy,
    tools as unknown as DiscoverNodiaAiToolsUseCase,
    selector as unknown as SelectNodiaAiTurnToolsUseCase,
    selectionFlow as unknown as NodiaAiToolSelectionFlowUseCase,
  );
  const summary = {
    conversation_id: 'chat',
    revision: 4,
    selection,
  } as unknown as NodiaAiConversationSummary;
  const chat = {
    id: 'chat',
    revision: 4,
    selected_connection_id: '2',
    selected_mode: 'token_plan_web',
    selected_model_id: 'fixture-model',
    selected_effort_id: null,
  } as NodiaAiConversation;
  const actor: NodiaAiAuthorizedActor = {
    actorId: '1',
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules: [
      { id: '2', key: 'finance', route: '/finance' },
      { id: '1', key: 'nodia_ai', route: '/tools/nodia-ai' },
    ],
  };
  const manager = {} as EntityManager;
  return {
    subject,
    adapter,
    knowledge,
    policy,
    eligibility,
    chat,
    actor,
    manager,
    summary,
    tools,
    selector,
  };
}

describe('Prepare NodiaAI admission', () => {
  it('freezes verified technical contracts without granting unpublished business operations', async () => {
    const f = fixture();
    const observation = await f.subject.observe(identity, f.summary);
    const prepared = await f.subject.prepare(
      f.manager,
      f.actor,
      f.chat,
      now,
      observation,
    );
    expect(prepared.allowedOperations).toEqual([
      'chat:respond',
      'nodia_capabilities_describe',
      'nodia_capabilities_search',
      'nodia_entities_search',
      'nodia_knowledge_get',
      'nodia_knowledge_index',
    ]);
    expect(prepared.contextManifest.tool_catalog_version).toBe('catalog');
    expect(prepared.contextManifest.tool_contracts).toEqual(
      expect.objectContaining({ nodia_capabilities_search: '4'.repeat(64) }),
    );
    expect(prepared.allowedModules).toEqual(['/finance', '/tools/nodia-ai']);
    expect(prepared.contextManifest.session_generation).toBe('3'.repeat(32));
    expect(f.selector.execute).toHaveBeenCalledTimes(1);
    expect(prepared.contextManifest.tool_selection_profile).toEqual({
      schema_version: 1,
      profile_id: 'published_reads',
      revision: 1,
      sha256: 'b'.repeat(64),
    });
    expect(f.adapter.verifyConfiguration).toHaveBeenCalledWith(
      selection,
      '2'.repeat(64),
      f.manager,
    );
    expect(f.adapter.observe).toHaveBeenCalledTimes(1);
    expect(prepared.selection).toEqual(selection);
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.selection)).toBe(true);
    expect(Object.isFrozen(observation.eligibility)).toBe(true);
  });
  it('freezes authorized reads and all proposal preparer kinds while gating an analyzer without its external protocol', async () => {
    const f = fixture();
    const capabilities = [
      {
        toolName: 'synthetic_read',
        kind: 'read',
        contractHash: '5'.repeat(64),
      },
      {
        toolName: 'synthetic_artifact',
        kind: 'read_artifact',
        contractHash: '7'.repeat(64),
      },
      {
        toolName: 'synthetic_prepare',
        kind: 'prepare_change',
        contractHash: '6'.repeat(64),
      },
      {
        toolName: 'synthetic_secure',
        kind: 'prepare_secure_flow',
        contractHash: '8'.repeat(64),
      },
      {
        toolName: 'synthetic_analyzer_with_external_protocol',
        kind: 'analyze_attachment',
        contractHash: 'a'.repeat(64),
        external: {
          prepare: async () => {
            throw Error('admission must not invoke the external port');
          },
        },
      },
      ...(
        [
          'prepare_workflow',
          'prepare_preference_change',
          'analyze_attachment',
        ] as const
      ).map((kind) => ({
        toolName: 'synthetic_' + kind,
        kind,
        contractHash: '9'.repeat(64),
      })),
    ];
    f.tools.visible.mockResolvedValue(capabilities);
    f.tools.registeredCatalog.mockReturnValue(
      capabilities as unknown as NodiaAiRegisteredTool[],
    );
    const observation = await f.subject.observe(identity, f.summary);
    const result = await f.subject.prepare(
      f.manager,
      f.actor,
      f.chat,
      now,
      observation,
    );
    expect(result.allowedOperations).toContain('synthetic_read');
    expect(result.allowedOperations).toContain('synthetic_artifact');
    expect(result.allowedOperations).toContain('synthetic_prepare');
    expect(result.allowedOperations).toContain('synthetic_secure');
    expect(result.allowedOperations).toContain(
      'synthetic_analyzer_with_external_protocol',
    );
    expect(result.allowedOperations).toContain('synthetic_prepare_workflow');
    expect(result.allowedOperations).toContain(
      'synthetic_prepare_preference_change',
    );
    expect(result.allowedOperations).not.toContain(
      'synthetic_analyze_attachment',
    );
    expect(result.contextManifest.tool_contracts).toEqual(
      expect.objectContaining({
        synthetic_read: '5'.repeat(64),
        synthetic_prepare: '6'.repeat(64),
        synthetic_secure: '8'.repeat(64),
        synthetic_prepare_workflow: '9'.repeat(64),
        synthetic_prepare_preference_change: '9'.repeat(64),
        synthetic_analyzer_with_external_protocol: 'a'.repeat(64),
      }),
    );
    expect(f.tools.visible).toHaveBeenCalledExactlyOnceWith(
      f.manager,
      f.actor,
      ['/finance', '/tools/nodia-ai'],
    );
  });
  it.each([null, { ...selection, mode: 'api_key' }])(
    'rejects missing/API selection before live observation',
    async (rejected) => {
      const f = fixture();
      f.summary.selection = rejected as NodiaAiSelection | null;
      await expect(f.subject.observe(identity, f.summary)).rejects.toThrow(
        'mode_unavailable',
      );
      expect(f.adapter.observe).not.toHaveBeenCalled();
    },
  );
  it('serialized or manufactured observations cannot forge the server-private capability', async () => {
    const f = fixture();
    const observation = await f.subject.observe(identity, f.summary);
    await expect(
      f.subject.prepare(
        f.manager,
        f.actor,
        f.chat,
        now,
        JSON.parse(JSON.stringify(observation)),
      ),
    ).rejects.toThrow('eligibility_changed');
    expect(f.adapter.verifyConfiguration).not.toHaveBeenCalled();
  });
  it.each([
    'actor',
    'session',
    'conversation',
    'revision',
    'connection',
    'model',
    'mode',
    'effort',
  ])('rejects changed %s at transactional admission', async (field) => {
    const f = fixture();
    const observation = await f.subject.observe(identity, f.summary);
    if (field === 'actor') f.actor.actorId = '3';
    if (field === 'session') f.actor.sessionId = 'another-session';
    if (field === 'conversation') f.chat.id = 'another-chat';
    if (field === 'revision') f.chat.revision++;
    if (field === 'connection') f.chat.selected_connection_id = '3';
    if (field === 'model') f.chat.selected_model_id = 'another-model';
    if (field === 'mode') f.chat.selected_mode = 'token_plan_agentic';
    if (field === 'effort') f.chat.selected_effort_id = 'high';
    await expect(
      f.subject.prepare(f.manager, f.actor, f.chat, now, observation),
    ).rejects.toThrow('eligibility_changed');
    expect(f.adapter.verifyConfiguration).not.toHaveBeenCalled();
    expect(f.knowledge.execute).not.toHaveBeenCalled();
  });
  it.each([-1, 300001, NaN])(
    'rejects stale, future or invalid observation age %s',
    async (age) => {
      const f = fixture();
      const observation = await f.subject.observe(identity, f.summary);
      await expect(
        f.subject.prepare(
          f.manager,
          f.actor,
          f.chat,
          new Date(now.getTime() + age),
          observation,
        ),
      ).rejects.toThrow('eligibility_changed');
    },
  );
  it.each(['unavailable', 'resource'])(
    'rejects %s before publishing grant/context',
    async (field) => {
      const f = fixture();
      if (field === 'unavailable') f.eligibility.available = false;
      else f.eligibility.resourceKey = null as unknown as string;
      const observation = await f.subject.observe(identity, f.summary);
      await expect(
        f.subject.prepare(f.manager, f.actor, f.chat, now, observation),
      ).rejects.toThrow('mode_unavailable');
      expect(f.knowledge.execute).not.toHaveBeenCalled();
    },
  );
  it('does not load knowledge or create a grant after configuration revocation', async () => {
    const f = fixture();
    const observation = await f.subject.observe(identity, f.summary);
    f.adapter.verifyConfiguration.mockRejectedValueOnce(
      new Error('configuration-revoked'),
    );
    await expect(
      f.subject.prepare(f.manager, f.actor, f.chat, now, observation),
    ).rejects.toThrow('configuration-revoked');
    expect(f.knowledge.execute).not.toHaveBeenCalled();
  });
  it('propagates an explicit selection rejection instead of granting every visible tool', async () => {
    const f = fixture();
    const observation = await f.subject.observe(identity, f.summary);
    f.selector.execute.mockImplementationOnce(() => {
      throw new Error('nodia_ai:tool_catalog_limit');
    });
    await expect(
      f.subject.prepare(f.manager, f.actor, f.chat, now, observation),
    ).rejects.toThrow('nodia_ai:tool_catalog_limit');
    expect(f.selector.execute).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['tool_selection_unknown', 400],
    ['tool_selection_changed', 409],
    ['capability_denied', 403],
    ['tool_catalog_limit', 503],
    ['tool_selection_unpublished', 503],
  ] as const)(
    'maps trusted selection rejection %s to HTTP %s',
    async (code, status) => {
      const f = fixture();
      const observation = await f.subject.observe(identity, f.summary);
      f.selector.execute.mockImplementationOnce(() => {
        throw new NodiaAiKnownPreDispatchError(`nodia_ai:${code}`);
      });
      await expect(
        f.subject.prepare(f.manager, f.actor, f.chat, now, observation),
      ).rejects.toMatchObject({ status });
    },
  );
});
