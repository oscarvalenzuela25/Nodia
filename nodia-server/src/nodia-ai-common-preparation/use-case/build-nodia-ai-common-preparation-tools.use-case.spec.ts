import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import type { NodiaAiProposalService } from '../../nodia-ai-proposal/nodia-ai-proposal.service.js';
import type { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import type { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import type { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { NodiaAiDraft } from '../../nodia-ai-proposal/entities/nodia-ai-draft.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { preferenceFixture } from '../../nodia-ai-preference/use-case/preference.fixture.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiWorkflowUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-workflow.use-case.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { NodiaAiCommonPreparationModule } from '../nodia-ai-common-preparation.module.js';
import { BuildNodiaAiCommonPreparationToolsUseCase } from './build-nodia-ai-common-preparation-tools.use-case.js';

const source = readFileSync(
  new URL(
    '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
    import.meta.url,
  ),
  'utf8',
);
const policy = runtimeFixture().policy;
function fixture() {
  const f = preferenceFixture();
  const now = new Date();
  const chat = {
    id: f.context.conversationId,
    owner_id: f.actor.actorId,
    expires_at: new Date(now.getTime() + 86400000),
    active_job_id: null,
  };
  const drafts = new Map<string, NodiaAiDraft>();
  const receipts = new Map<string, NodiaAiToolCall>();
  const saved = new Map<
    string,
    {
      proposal: NodiaAiProposal;
      revision: NodiaAiProposalRevision;
      steps: NodiaAiProposalStep[];
    }
  >();
  const oldQuery = f.manager.query.bind(f.manager);
  Object.assign(f.manager, {
    query: vi.fn(async (sql: string, params?: unknown[]) =>
      sql.startsWith('SELECT id FROM nodia_ai_tool_calls')
        ? receipts.has(String(params?.[0]))
          ? [{ id: params![0] }]
          : []
        : oldQuery(sql, params),
    ),
    getRepository: (entity: unknown) => {
      if (entity === NodiaAiDraft)
        return {
          findOneBy: vi.fn(
            async (where: Partial<NodiaAiDraft>) =>
              [...drafts.values()].find((d) =>
                Object.entries(where).every(
                  ([key, value]) => d[key as keyof NodiaAiDraft] === value,
                ),
              ) ?? null,
          ),
          save: vi.fn(async (draft: NodiaAiDraft) => {
            drafts.set(draft.id, draft);
            return draft;
          }),
        };
      if (entity === NodiaAiToolCall)
        return {
          findOneBy: vi.fn(
            async (where: Partial<NodiaAiToolCall>) =>
              [...receipts.values()].find((d) =>
                Object.entries(where).every(
                  ([key, value]) => d[key as keyof NodiaAiToolCall] === value,
                ),
              ) ?? null,
          ),
        };
      throw Error('No business persistence allowed in preparation');
    },
  });
  const store = {
    insertDraft: vi.fn(async (_m: EntityManager, d: NodiaAiDraft) => {
      drafts.set(d.id, d);
    }),
    create: vi.fn(
      async (
        _m: EntityManager,
        proposal: NodiaAiProposal,
        revision: NodiaAiProposalRevision,
        steps: NodiaAiProposalStep[],
      ) => {
        saved.set(proposal.id, { proposal, revision, steps });
      },
    ),
    publishReady: vi.fn(async () => undefined),
    proposal: vi.fn(
      async (_m: EntityManager, id: string) => saved.get(id)?.proposal ?? null,
    ),
    revision: vi.fn(async (_m: EntityManager, id: string, revision: number) =>
      saved.get(id)?.revision.revision === revision
        ? saved.get(id)!.revision
        : null,
    ),
    steps: vi.fn(
      async (_m: EntityManager, id: string) => saved.get(id)?.steps ?? [],
    ),
  };
  const authorizeChat = {
    execute: vi.fn(async () => ({ actor: f.actor, chat, now })),
  };
  const validate = new ValidateNodiaAiProposalUseCase(
    f.build.operations,
    source,
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
  const prep = new PrepareNodiaAiProposalUseCase(
    store as unknown as NodiaAiProposalService,
    authorizeChat as never,
    f.authorize as never,
    validate,
    policy,
  );
  const get = new GetNodiaAiProposalUseCase(
    store as unknown as NodiaAiProposalService,
    f.authorize as never,
    authorizeChat as never,
    validate,
    policy,
  );
  const workflow = {
    execute: vi.fn(async () => {
      throw Error('Workflow must only execute from an armed callback');
    }),
  };
  const builder = new BuildNodiaAiCommonPreparationToolsUseCase(
    prep,
    workflow as unknown as PrepareNodiaAiWorkflowUseCase,
    get,
    validate,
    source,
    policy,
  );
  const family = builder.execute()[0];
  const tools = new Map(family.capabilities.map((t) => [t.toolName, t]));
  const context: NodiaAiToolHandlerContext = {
    manager: f.manager,
    actor: f.actor,
    moduleRoutes: f.actor.modules.map((m) => m.route),
    conversationId: chat.id,
    runId: randomUUID(),
    attemptId: randomUUID(),
    toolCallId: randomUUID(),
  };
  receipts.set(
    context.toolCallId!,
    Object.assign(new NodiaAiToolCall(), {
      id: context.toolCallId,
      conversation_id: chat.id,
      tool_name: 'nodia_preferences_prepare',
      state: 'validated',
      public_result: null,
    }),
  );
  const preference = tools.get('nodia_preferences_prepare')!;
  return {
    ...f,
    chat,
    drafts,
    receipts,
    saved,
    store,
    validate,
    builder,
    family,
    tools,
    context,
    preference,
    workflow,
    valid: (name: string, input: unknown) =>
      compileNodiaAiToolSchema(tools.get(name)!.inputSchema).validate(input),
  };
}

describe('Common MCP preparation candidates', () => {
  it('has no publication dependencies by default and rejects unknown selections', () => {
    expect(
      NodiaAiCommonPreparationModule.forPublication([]).imports,
    ).toBeUndefined();
    expect(() =>
      NodiaAiCommonPreparationModule.forPublication([
        'nodia_preferences_prepare_create',
      ]),
    ).toThrow('nodia_ai:knowledge_release_invalid');
    expect(() =>
      NodiaAiCommonPreparationModule.forPublication([
        'nodia_preferences_prepare',
        'nodia_preferences_prepare',
      ]),
    ).toThrow();
  });
  it('exports exactly two helpers with native-bound hashes and closed contracts', () => {
    const f = fixture();
    expect([...f.tools.keys()]).toEqual([
      'nodia_workflows_prepare',
      'nodia_preferences_prepare',
    ]);
    for (const tool of f.tools.values()) {
      expect(compileNodiaAiToolSchema(tool.outputSchema)).toBeDefined();
      expect(tool.requiredModuleRoutes).toEqual(['/tools/nodia-ai']);
    }
    expect(f.preference.inputSchema.sourceJson).toContain(
      f.build.operations[0].contractHash,
    );
  });
  it.each([
    { operation: 'create', partial: {}, actor_id: '2' },
    { operation: 'create', partial: {}, conversation_id: randomUUID() },
    { operation: 'create', partial: { schema_version: 1 } },
    { operation: 'create', partial: { key: 'arbitrary_memory', value: 'x' } },
    {
      operation: 'create',
      partial: {
        scope_key: 'business',
        key: 'expense_category_id',
        scope: {},
        value: '7',
      },
    },
    {
      operation: 'create',
      partial: { key: 'supplier_id', scope: {}, value: '7' },
    },
    { operation: 'create', partial: { key: 'business_id', value: '7' } },
    { operation: 'delete', partial: { id: randomUUID(), value: '7' } },
    {
      operation: 'update',
      partial: { id: randomUUID(), expected_revision: 0 },
    },
    {
      operation: 'update',
      partial: { id: randomUUID(), expected_revision: 1 },
      draft_id: randomUUID(),
    },
    { operation: 'create', partial: { scope: { user_id: '2' } } },
  ])('rejects unbounded or contradictory preference input %j', (args) => {
    expect(fixture().valid('nodia_preferences_prepare', args)).toBe(false);
  });
  it.each([
    { scope_key: 'finance', key: 'expense_category_id', scope: {}, value: '7' },
    { scope_key: 'finance', key: 'income_category_id', scope: {}, value: '7' },
    {
      scope_key: 'business',
      key: 'business_id',
      scope: {},
      value: randomUUID(),
    },
    {
      scope_key: 'business',
      key: 'supplier_id',
      scope: { business_id: randomUUID() },
      value: '7',
    },
    { scope_key: 'rental', key: 'property_id', scope: {}, value: '7' },
  ])('accepts the native closed catalog %j', (partial) => {
    expect(
      fixture().valid('nodia_preferences_prepare', {
        operation: 'create',
        partial,
      }),
    ).toBe(true);
  });
  it('uses native preparation with an incomplete draft, revision CAS, and no accepted memory effect', async () => {
    const f = fixture();
    const incomplete = await f.preference.handler(
      { operation: 'create', partial: {} },
      f.context,
    );
    expect(incomplete.status).toBe('needs_clarification');
    expect(incomplete.draft_revision).toBe(1);
    const args = {
      operation: 'create',
      partial: f.create,
      draft_id: incomplete.draft_id,
      expected_draft_revision: 1,
    };
    await expect(
      f.preference.handler({ ...args, expected_draft_revision: 2 }, f.context),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    const ready = await f.preference.handler(args, f.context);
    expect(ready.status).toBe('ready');
    expect(ready.draft_revision).toBe(2);
    expect(f.drafts).toHaveLength(1);
    expect(f.rows).toHaveLength(0);
    expect(f.repository.save).not.toHaveBeenCalled();
    expect(f.repository.delete).not.toHaveBeenCalled();
    const proposal = ready.proposal as NodiaAiJsonObject;
    expect(proposal.state).toBe('ready');
    expect(proposal.execution_id).toBeNull();
    expect(f.store.create).toHaveBeenCalledOnce();
  });
  it('rechecks target module and actor-only memory using native rules', async () => {
    const f = fixture();
    f.actor.modules = f.actor.modules.filter(
      (m) => m.route !== '/tools/finances-personal',
    );
    await expect(
      f.preference.handler(
        { operation: 'create', partial: f.create },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.saved.size).toBe(0);
    f.setChatOwner('2');
    await expect(
      f.preference.handler({ operation: 'create', partial: {} }, f.context),
    ).rejects.toThrow('nodia_ai:author_required');
  });
  it.each(['update', 'delete'] as const)(
    'only proposes %s and preserves the accepted preference',
    async (operation) => {
      const f = fixture(),
        row = f.seed();
      const args = {
        operation,
        partial: {
          id: row.id,
          expected_revision: row.revision,
          ...(operation === 'update' ? { value: '8' } : {}),
        },
      };
      const result = await f.preference.handler(args, f.context);
      expect(result.status).toBe('ready');
      expect(f.rows).toHaveLength(1);
      expect(f.rows[0].value).toBe('7');
      expect(f.rows[0].revision).toBe(1);
      expect(f.repository.save).not.toHaveBeenCalled();
      expect(f.repository.delete).not.toHaveBeenCalled();
      await f.preference.verifyResultAuthority!(args, result, {
        ...f.context,
        attemptId: undefined,
      });
    },
  );
  it('rejects foreign preference targets and stale accepted revisions before creating drafts', async () => {
    const f = fixture(),
      target = f.seed({ owner_id: '2' });
    await expect(
      f.preference.handler(
        {
          operation: 'delete',
          partial: { id: target.id, expected_revision: 1 },
        },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:preference_not_found');
    const own = f.seed({ revision: 2 });
    await expect(
      f.preference.handler(
        {
          operation: 'update',
          partial: { id: own.id, expected_revision: 1, value: '8' },
        },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.drafts.size).toBe(0);
    expect(f.saved.size).toBe(0);
  });
  it('revalidates target authority after a preparation was persisted', async () => {
    const f = fixture(),
      args = { operation: 'create', partial: f.create };
    const result = await f.preference.handler(args, f.context);
    f.actor.modules = f.actor.modules.filter(
      (m) => m.route !== '/tools/finances-personal',
    );
    await expect(
      f.preference.verifyResultAuthority!(args, result, f.context),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.rows).toHaveLength(0);
  });
  it('rejects a forged public value or hash during stored result recovery', async () => {
    const f = fixture();
    const args = { operation: 'create', partial: f.create };
    const result = await f.preference.handler(args, f.context);
    await f.preference.verifyResultAuthority!(args, result, {
      ...f.context,
      attemptId: undefined,
      runId: undefined,
    });
    const changed = structuredClone(result);
    const proposal = changed.proposal as NodiaAiJsonObject;
    const step = (proposal.steps as NodiaAiJsonObject[])[0];
    (step.changes as NodiaAiJsonObject[])[0].after = 'forged';
    await expect(
      f.preference.verifyResultAuthority!(args, changed, f.context),
    ).rejects.toThrow();
  });
  it('preserves immutable completed clarification receipts when the draft advances', async () => {
    const f = fixture(),
      args = { operation: 'create', partial: {} };
    const initial = await f.preference.handler(args, f.context);
    const receipt = f.receipts.get(f.context.toolCallId!)!;
    Object.assign(receipt, {
      state: 'completed',
      public_result: structuredClone(initial),
    });
    await f.preference.handler(
      {
        operation: 'create',
        partial: f.create,
        draft_id: initial.draft_id,
        expected_draft_revision: 1,
      },
      f.context,
    );
    await f.preference.verifyResultAuthority!(args, initial, {
      ...f.context,
      attemptId: undefined,
    });
    receipt.public_result = null;
    await expect(
      f.preference.verifyResultAuthority!(args, initial, f.context),
    ).rejects.toThrow();
  });
  it('requires the backend-owned callback identity and rejects model execution keys', async () => {
    const f = fixture();
    await expect(
      f.preference.handler(
        { operation: 'create', partial: {} },
        { ...f.context, toolCallId: undefined },
      ),
    ).rejects.toThrow();
    for (const delta of [
      { confirm: true },
      { execution_id: randomUUID() },
      { run_id: randomUUID() },
    ])
      expect(
        f.valid('nodia_workflows_prepare', {
          catalog_version: 'nodia-ai-ai23-workflow/1',
          draft_ids: [randomUUID()],
          ...delta,
        }),
      ).toBe(false);
    await expect(
      f.tools.get('nodia_workflows_prepare')!.handler(
        {
          catalog_version: 'nodia-ai-ai23-workflow/1',
          draft_ids: [randomUUID()],
        },
        { ...f.context, attemptId: undefined },
      ),
    ).rejects.toThrow();
    expect(f.workflow.execute).not.toHaveBeenCalled();
  });
  it('bounds workflow order, bindings and catalog before native coordination', () => {
    const f = fixture(),
      a = randomUUID(),
      b = randomUUID();
    const good = {
      catalog_version: 'nodia-ai-ai23-workflow/1',
      draft_ids: [a, b],
      bindings: [
        {
          draft_id: b,
          target_field_key: 'provider_id',
          from_draft_id: a,
          output_key: 'id',
        },
      ],
    };
    expect(f.valid('nodia_workflows_prepare', good)).toBe(true);
    for (const bad of [
      { ...good, catalog_version: 'other' },
      { ...good, draft_ids: [a, a] },
      { ...good, draft_ids: Array.from({ length: 9 }, () => randomUUID()) },
      { ...good, bindings: [{ ...good.bindings[0], command: 'SQL' }] },
    ])
      expect(f.valid('nodia_workflows_prepare', bad)).toBe(false);
  });
});
