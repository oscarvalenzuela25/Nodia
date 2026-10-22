import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiProposalPreparer } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { NodiaAiToolRegistryUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import { NodiaAiDraft } from '../../nodia-ai-proposal/entities/nodia-ai-draft.entity.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import type { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import type { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import type { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiProposalService } from '../../nodia-ai-proposal/nodia-ai-proposal.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { policyEnvelope } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { ValidateNodiaAiRuntimePolicyUseCase } from '../../nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js';
import { PrepareNodiaAiFinanceMovementUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js';
import { PrepareNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import {
  loadNodiaAiSecureContracts,
  loadNodiaAiWriteContracts,
} from '../types/write-tool-contract.types.js';
import { BuildNodiaAiWriteToolsUseCase } from './build-nodia-ai-write-tools.use-case.js';
import { BuildNodiaAiFinanceCatalogOperationsUseCase } from '../../nodia-ai-finance-catalog/use-case/build-nodia-ai-finance-catalog-operations.use-case.js';
import { BuildNodiaAiFinanceLedgerOperationsUseCase } from '../../nodia-ai-finance-ledger/use-case/build-nodia-ai-finance-ledger-operations.use-case.js';
import { BuildNodiaAiBusinessCatalogOperationsUseCase } from '../../nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.js';
import { BuildNodiaAiSupplierOperationsUseCase } from '../../nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.js';
import { BuildNodiaAiInvoiceOperationsUseCase } from '../../nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.js';
import { BuildNodiaAiRentalConfigurationOperationsUseCase } from '../../nodia-ai-rental-configuration/use-case/build-nodia-ai-rental-configuration-operations.use-case.js';
import { BuildNodiaAiRentalReservationOperationsUseCase } from '../../nodia-ai-rental-reservation/use-case/build-nodia-ai-rental-reservation-operations.use-case.js';
import { BuildNodiaAiRentalMoneyOperationsUseCase } from '../../nodia-ai-rental-money/use-case/build-nodia-ai-rental-money-operations.use-case.js';
import { BuildNodiaAiRentalOperationsUseCase } from '../../nodia-ai-rental-operations/use-case/build-nodia-ai-rental-operations.use-case.js';
import { BuildNodiaAiCoreOperationsUseCase } from '../../nodia-ai-core-operations/use-case/build-nodia-ai-core-operations.use-case.js';
import { BuildNodiaAiProviderOperationsUseCase } from '../../nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.js';
import { BuildNodiaAiSecureOperationsUseCase } from '../../nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.js';
const commonSource = readFileSync(
  new URL(
    '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
    import.meta.url,
  ),
  'utf8',
);
const bundles = loadNodiaAiWriteContracts();
const secureBundles = loadNodiaAiSecureContracts();
// Policy and native validators are immutable. Persisted drafts, actors, authorization and stores stay local to each test.
// This avoids compiling the same 15 common definitions three times on every fixture construction.
const policy = new ValidateNodiaAiRuntimePolicyUseCase().execute(
  policyEnvelope(),
);
const financialPreparer = new PrepareNodiaAiFinanceMovementUseCase(
  new FinanceLedgerService({
    transaction: () => {
      throw Error('No independent transaction');
    },
  } as unknown as DataSource),
);

const nativeFactories = [
  BuildNodiaAiFinanceCatalogOperationsUseCase,
  BuildNodiaAiFinanceLedgerOperationsUseCase,
  BuildNodiaAiBusinessCatalogOperationsUseCase,
  BuildNodiaAiSupplierOperationsUseCase,
  BuildNodiaAiInvoiceOperationsUseCase,
  BuildNodiaAiRentalConfigurationOperationsUseCase,
  BuildNodiaAiRentalReservationOperationsUseCase,
  BuildNodiaAiRentalMoneyOperationsUseCase,
  BuildNodiaAiRentalOperationsUseCase,
  BuildNodiaAiCoreOperationsUseCase,
  BuildNodiaAiProviderOperationsUseCase,
  BuildNodiaAiSecureOperationsUseCase,
];
function structuralPreparers(): readonly NodiaAiProposalPreparer[] {
  const forbidden = new Proxy(
    {},
    {
      get: () => {
        throw Error(
          'No domain, database, writer or provider may run in structural compilation',
        );
      },
    },
  );
  const prepared = nativeFactories.flatMap(
    (Factory) =>
      (
        Reflect.construct(Factory, Array(35).fill(forbidden)) as {
          operations: NodiaAiProposalPreparer[];
        }
      ).operations,
  );
  prepared.push(
    new PrepareNodiaAiFinanceMovementUseCase(forbidden as FinanceLedgerService),
  );
  return prepared.filter(
    (port) => !port.toolName.startsWith('nodia_secure_flows_'),
  );
}
function constructValidate(preparers: readonly NodiaAiProposalPreparer[]) {
  return new ValidateNodiaAiProposalUseCase(
    preparers,
    commonSource,
    policy,
    new CanonicalizeNodiaAiProposalUseCase(policy),
  );
}
const financialValidate = constructValidate([financialPreparer]);
const structuralNativePreparers = structuralPreparers();
const structuralValidate = constructValidate(structuralNativePreparers);
const secureStore = {
  provider: vi.fn(async () => ({
    id: '2',
    name: 'Synthetic connection',
    provider_key: 'gemini',
    is_active: true,
    catalog_active: true,
    can_use_api_key: true,
    use_api_key: true,
    can_use_token_plan_web: true,
    use_token_plan_web: true,
    can_use_token_plan_agentic: true,
    use_token_plan_agentic: true,
  })),
  keys: vi.fn(async () => [
    {
      id: '3',
      label: 'Synthetic existing key',
      is_active: true,
      is_selected: true,
      sort_order: 0,
    },
  ]),
};
const securePreparers = new BuildNodiaAiSecureOperationsUseCase(
  secureStore as unknown as ConstructorParameters<
    typeof BuildNodiaAiSecureOperationsUseCase
  >[0],
).operations.filter((port) => port.toolName.startsWith('nodia_secure_flows_'));
const secureValidate = constructValidate(securePreparers);
function fixture(secureToolName?: string) {
  const preparer = secureToolName
    ? securePreparers.find((port) => port.toolName === secureToolName)!
    : financialPreparer;
  const validate = secureToolName ? secureValidate : financialValidate;
  const now = new Date('2026-10-16T12:00:00.000Z');
  const identity = { userId: '1', sessionId: randomUUID() };
  const actor = {
    actorId: identity.userId,
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules: [
      ...preparer.moduleRoutes.map((route) => ({
        id: '1',
        key: 'synthetic',
        route,
      })),
      ...(secureToolName
        ? [{ id: '2', key: 'nodia_ai', route: '/tools/nodia-ai' }]
        : []),
    ],
  };
  const chat = {
    id: randomUUID(),
    owner_id: '1',
    expires_at: new Date(now.getTime() + 86400000),
    active_job_id: null,
  };
  const manager = {
    query: vi.fn(async () => []),
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const f = {
    policy,
    now,
    identity,
    actor,
    chat,
    manager,
    authorize: { execute: vi.fn(async () => actor) },
    authorizeChat: { execute: vi.fn(async () => ({ actor, chat, now })) },
  };
  const drafts = new Map<string, NodiaAiDraft>();
  const proposals = new Map<string, NodiaAiProposal>();
  const revisions = new Map<string, NodiaAiProposalRevision>();
  const steps = new Map<string, NodiaAiProposalStep[]>();
  const calls = new Map<string, NodiaAiToolCall>();
  const domainSave = vi.fn(() => {
    throw Error('Preparation must not execute domain effects');
  });
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('SELECT u.id')
      ? [
          {
            actorId: f.actor.actorId,
            sessionId: f.actor.sessionId,
            isSuperAdmin: false,
          },
        ]
      : sql.includes(' AS module')
        ? [{ module: true, action: true }]
        : [],
  );
  Object.assign(f.manager, {
    query,
    getRepository: (type: unknown) => {
      if (type === NodiaAiDraft)
        return {
          findOneBy: vi.fn(
            async (where: Partial<NodiaAiDraft>) =>
              [...drafts.values()].find((row) =>
                Object.entries(where).every(
                  ([key, value]) => row[key as keyof NodiaAiDraft] === value,
                ),
              ) ?? null,
          ),
          save: vi.fn(async (row: NodiaAiDraft) => {
            drafts.set(row.id, row);
            return row;
          }),
        };
      if (type === NodiaAiToolCall)
        return {
          findOneBy: vi.fn(
            async (where: Partial<NodiaAiToolCall>) =>
              [...calls.values()].find((row) =>
                Object.entries(where).every(
                  ([key, value]) => row[key as keyof NodiaAiToolCall] === value,
                ),
              ) ?? null,
          ),
        };
      return {
        findOne: vi.fn(async () =>
          Object.assign(new FinanceCategory(), {
            id: '7',
            user_id: '1',
            name: 'Comida',
            key: 'food',
            is_active: true,
            updated_at: f.now,
          }),
        ),
        save: domainSave,
      };
    },
  });
  const store = {
    transaction: async <T>(work: (manager: typeof f.manager) => Promise<T>) =>
      work(f.manager),
    insertDraft: vi.fn(async (_manager: unknown, row: NodiaAiDraft) => {
      drafts.set(row.id, row);
    }),
    create: vi.fn(
      async (
        _manager: unknown,
        proposal: NodiaAiProposal,
        revision: NodiaAiProposalRevision,
        rows: NodiaAiProposalStep[],
      ) => {
        proposals.set(proposal.id, proposal);
        revisions.set(proposal.id, revision);
        steps.set(proposal.id, rows);
      },
    ),
    publishReady: vi.fn(),
    proposal: vi.fn(
      async (_manager: unknown, id: string) => proposals.get(id) ?? null,
    ),
    revision: vi.fn(
      async (_manager: unknown, id: string) => revisions.get(id) ?? null,
    ),
    steps: vi.fn(async (_manager: unknown, id: string) => steps.get(id) ?? []),
  };
  const prepare = new PrepareNodiaAiProposalUseCase(
    store as unknown as NodiaAiProposalService,
    f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
    validate,
    f.policy,
  );
  const get = new GetNodiaAiProposalUseCase(
    store as unknown as NodiaAiProposalService,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
    f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
    validate,
    f.policy,
  );
  const bundle = {
    ...(secureToolName ? secureBundles[0] : bundles[0]),
    tools: (secureToolName ? secureBundles[0] : bundles[0]).tools.filter(
      (tool) => tool.tool_name === preparer.toolName,
    ),
  };
  const builder = new BuildNodiaAiWriteToolsUseCase(
    prepare,
    get,
    validate,
    commonSource,
    f.policy,
  );
  const tool = builder.execute([bundle])[0].capabilities[0];
  const context: NodiaAiToolHandlerContext = {
    manager: f.manager,
    actor: f.actor,
    moduleRoutes: secureToolName
      ? ['/tools/nodia-ai', ...preparer.moduleRoutes]
      : [...preparer.moduleRoutes],
    conversationId: f.chat.id,
  };
  const initial = {
    name: 'Comida',
    amount: '20000',
    category_id: '7',
    type: 'expense',
  };
  return {
    ...f,
    drafts,
    proposals,
    revisions,
    steps,
    calls,
    store,
    prepare,
    get,
    validate,
    preparer,
    builder,
    bundle,
    tool,
    context,
    initial,
    domainSave,
  };
}

describe('BuildNodiaAiWriteToolsUseCase — candidate MCP adapters', () => {
  it('covers exactly all 73 real domain preparers and excludes the four secure-flow gates', () => {
    const preparers = structuralNativePreparers;
    expect(preparers).toHaveLength(73);
    expect(
      bundles
        .flatMap((bundle) => bundle.tools.map((tool) => tool.tool_name))
        .sort(),
    ).toEqual(preparers.map((port) => port.toolName).sort());
  });
  it.each(
    bundles.flatMap((bundle) => bundle.tools.map((tool) => ({ bundle, tool }))),
  )(
    'compiles and registers closed input/output for $tool.tool_name without executing dependencies',
    ({ bundle, tool }) => {
      // Candidate-only slicing bounds independent unit work; these hashes are not publication evidence.
      const accessApplication = vi.fn(() => {
        throw Error('Structural compilation must not access application ports');
      });
      const applicationPort = new Proxy({}, { get: accessApplication });
      const families = new BuildNodiaAiWriteToolsUseCase(
        applicationPort as PrepareNodiaAiProposalUseCase,
        applicationPort as GetNodiaAiProposalUseCase,
        structuralValidate,
        commonSource,
        policy,
      ).execute([{ ...bundle, tools: [tool] }]);
      const registry = new NodiaAiToolRegistryUseCase(
        families,
        'ai36-c01-synthetic-registration/1',
      );
      const routes = [
        ...new Set(
          structuralNativePreparers.flatMap((port) => port.moduleRoutes),
        ),
      ];
      const registered = registry.list(routes);
      expect(registered).toHaveLength(1);
      expect(registered[0].toolName).toBe(tool.tool_name);
      expect(registered[0].kind).toBe('prepare_change');
      expect(registry.validateInput(registered[0], { partial: {} })).toEqual({
        partial: {},
      });
      expect(() =>
        registry.validateInput(registered[0], { partial: {}, sql: 'DELETE' }),
      ).toThrow();
      expect(() =>
        registry.validateOutput(registered[0], { status: 'ready' }),
      ).toThrow();
      expect(accessApplication).not.toHaveBeenCalled();
    },
  );
  it('changes the MCP contract hash when the native preparer contract changes', () => {
    const f = fixture();
    const oldRegistry = new NodiaAiToolRegistryUseCase(
      f.builder.execute([f.bundle]),
      'same-synthetic-catalog/1',
    );
    const nextPreparer = Object.create(f.preparer) as NodiaAiProposalPreparer;
    Object.defineProperty(nextPreparer, 'contractHash', {
      value: 'f'.repeat(64),
    });
    const nextValidate = constructValidate([nextPreparer]);
    const nextBuilder = new BuildNodiaAiWriteToolsUseCase(
      f.prepare,
      f.get,
      nextValidate,
      commonSource,
      f.policy,
    );
    const nextRegistry = new NodiaAiToolRegistryUseCase(
      nextBuilder.execute([f.bundle]),
      'same-synthetic-catalog/1',
    );
    expect(nextRegistry.get(f.preparer.toolName)?.contractHash).not.toBe(
      oldRegistry.get(f.preparer.toolName)?.contractHash,
    );
  });
  it('rejects missing or duplicate native contracts without publishing a partial family', () => {
    const f = fixture();
    expect(() =>
      f.builder.execute([
        { ...f.bundle, tools: [...f.bundle.tools, ...f.bundle.tools] },
      ]),
    ).toThrow('nodia_ai:write_contract_invalid');
    expect(() =>
      f.builder.execute([
        {
          ...f.bundle,
          tools: [
            { ...f.bundle.tools[0], input_definition: 'MissingDefinition' },
          ],
        },
      ]),
    ).toThrow('nodia_ai:write_contract_invalid');
    expect(() =>
      f.builder.execute([
        {
          ...f.bundle,
          tools: [
            { ...f.bundle.tools[0], tool_name: 'nodia_missing_prepare_create' },
          ],
        },
      ]),
    ).toThrow('nodia_ai:catalog_changed');
  });
  it('persists clarification, resumes by exact CAS, produces the native public proposal and never writes the domain', async () => {
    const f = fixture();
    const first = await f.tool.handler({ partial: f.initial }, f.context);
    expect(first).toMatchObject({
      status: 'needs_clarification',
      draft_revision: 1,
      proposal: null,
      missing_fields: ['status'],
      error: null,
    });
    expect(f.drafts.size).toBe(1);
    await expect(
      f.tool.handler(
        {
          partial: { status: 'paid' },
          draft_id: first.draft_id,
          expected_draft_revision: 2,
        },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    expect(f.proposals.size).toBe(0);
    const result = await f.tool.handler(
      {
        partial: { status: 'paid' },
        draft_id: first.draft_id,
        expected_draft_revision: 1,
      },
      f.context,
    );
    expect(result).toMatchObject({
      status: 'ready',
      draft_id: first.draft_id,
      draft_revision: 2,
      missing_fields: [],
      clarification_keys: [],
      error: null,
    });
    const draft = f.drafts.get(String(result.draft_id))!;
    expect(draft.partial_command.command).toMatchObject({
      ...f.initial,
      status: 'paid',
    });
    expect(draft.state).toBe('ready');
    expect(f.proposals.size).toBe(1);
    expect(f.store.publishReady).toHaveBeenCalledOnce();
    const proposal = result.proposal as NodiaAiJsonObject;
    const loaded = await f.get.execute(
      f.identity,
      String(proposal.proposal_id),
      Number(proposal.revision),
    );
    expect(proposal).toEqual(loaded);
    expect(draft.claimed_proposal_id).toBe(proposal.proposal_id);
    expect(f.domainSave).not.toHaveBeenCalled();
  });
  it('rejects invalid envelopes and context before draft persistence', async () => {
    const f = fixture();
    const invalidInputs: NodiaAiJsonObject[] = [
      { partial: {}, draft_id: randomUUID() },
      { partial: {}, expected_draft_revision: 1 },
      { partial: {}, draft_id: randomUUID(), expected_draft_revision: 0 },
      { partial: {}, confirmed: true },
      { partial: { schema_version: 1 } },
      { partial: { amount: 20000 } },
      { partial: [], draft_id: null },
      { partial: { command: { name: 'injected' } } },
    ];
    for (const input of invalidInputs)
      await expect(f.tool.handler(input, f.context)).rejects.toThrow(
        'nodia_ai:invalid_tool_input',
      );
    for (const context of [
      { ...f.context, conversationId: undefined },
      { ...f.context, moduleRoutes: [] },
      { ...f.context, signal: AbortSignal.abort() },
      {
        ...f.context,
        manager: {
          queryRunner: { isTransactionActive: false },
        } as typeof f.manager,
      },
    ])
      await expect(f.tool.handler({ partial: {} }, context)).rejects.toThrow(
        'nodia_ai:invalid_tool_input',
      );
    expect(f.drafts.size).toBe(0);
    expect(f.proposals.size).toBe(0);
  });
  it('revalidates draft ownership, conversation, native tool and catalog on result replay', async () => {
    for (const mutation of [
      (draft: NodiaAiDraft) => {
        draft.actor_id = '2';
      },
      (draft: NodiaAiDraft) => {
        draft.conversation_id = randomUUID();
      },
      (draft: NodiaAiDraft) => {
        draft.tool_name = 'nodia_other_prepare_create';
      },
      (draft: NodiaAiDraft) => {
        draft.catalog_version = 'another-release/1';
      },
    ]) {
      const f = fixture();
      const result = await f.tool.handler({ partial: f.initial }, f.context);
      mutation(f.drafts.get(String(result.draft_id))!);
      await expect(
        f.tool.verifyResultAuthority!(
          { partial: f.initial },
          result,
          f.context,
        ),
      ).rejects.toThrow('nodia_ai:draft_not_found');
    }
  });
  it('rejects public proposal tampering even if the declared immutable hash is retained', async () => {
    const f = fixture();
    const result = await f.tool.handler(
      { partial: { ...f.initial, status: 'paid' } },
      f.context,
    );
    const tampered = structuredClone(result);
    const proposal = tampered.proposal as NodiaAiJsonObject;
    const step = (proposal.steps as NodiaAiJsonObject[])[0];
    (step.changes as NodiaAiJsonObject[])[0].after = 'False displayed value';
    await expect(
      f.tool.verifyResultAuthority!({}, tampered, f.context),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
  });
  it('rejects a result that mixes a draft with another proposal from the same owner and chat', async () => {
    const f = fixture();
    const first = await f.tool.handler(
      { partial: { ...f.initial, status: 'paid' } },
      f.context,
    );
    const second = await f.tool.handler(
      { partial: { ...f.initial, name: 'Second intent', status: 'paid' } },
      f.context,
    );
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...first, proposal: second.proposal },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
  });
  it('rejects fresh clarification receipts for ready drafts and future draft revisions', async () => {
    const f = fixture();
    const result = await f.tool.handler(
      { partial: { ...f.initial, status: 'paid' } },
      f.context,
    );
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        {
          ...result,
          status: 'needs_clarification',
          proposal: null,
          missing_fields: ['status'],
          clarification_keys: ['nodia_ai:field_required'],
        },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...result, draft_revision: 2 },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
  });
  it('rejects altered clarification questions and empty required-question receipts', async () => {
    const f = fixture();
    const result = await f.tool.handler({ partial: f.initial }, f.context);
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...result, missing_fields: ['bank_password'] },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...result, clarification_keys: ['nodia_ai:wrong_question'] },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...result, missing_fields: [], clarification_keys: [] },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
  });
  it('replays an exact historical clarification only through its completed backend tool receipt', async () => {
    const f = fixture();
    const first = await f.tool.handler({ partial: f.initial }, f.context);
    const ready = await f.tool.handler(
      {
        partial: { status: 'paid' },
        draft_id: first.draft_id,
        expected_draft_revision: 1,
      },
      f.context,
    );
    expect(ready.draft_revision).toBe(2);
    await expect(
      f.tool.verifyResultAuthority!({}, first, f.context),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    const call = Object.assign(new NodiaAiToolCall(), {
      id: randomUUID(),
      conversation_id: f.chat.id,
      tool_name: f.tool.toolName,
      state: 'completed',
      public_result: structuredClone(first),
    });
    f.calls.set(call.id, call);
    const context = { ...f.context, toolCallId: call.id };
    await expect(
      f.tool.verifyResultAuthority!({}, first, context),
    ).resolves.toBeUndefined();
    call.state = 'running';
    await expect(
      f.tool.verifyResultAuthority!({}, first, context),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    call.state = 'completed';
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...first, missing_fields: ['not_the_recorded_question'] },
        context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    call.conversation_id = randomUUID();
    await expect(
      f.tool.verifyResultAuthority!({}, first, context),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
  });
  it('retains the original ready snapshot after the proposal advances while reauthorizing its native resource', async () => {
    const f = fixture();
    const result = await f.tool.handler(
      { partial: { ...f.initial, status: 'paid' } },
      f.context,
    );
    const proposalId = String(
      (result.proposal as NodiaAiJsonObject).proposal_id,
    );
    const draft = f.drafts.get(String(result.draft_id))!;
    draft.revision += 1;
    draft.state = 'claimed';
    f.revisions.get(proposalId)!.state = 'confirmed';
    const call = Object.assign(new NodiaAiToolCall(), {
      id: randomUUID(),
      conversation_id: f.chat.id,
      tool_name: f.tool.toolName,
      state: 'completed',
      public_result: structuredClone(result),
    });
    f.calls.set(call.id, call);
    const context = { ...f.context, toolCallId: call.id };
    await expect(
      f.tool.verifyResultAuthority!({}, result, context),
    ).resolves.toBeUndefined();
    f.authorize.execute.mockRejectedValueOnce(
      Error('native_authority_revoked'),
    );
    await expect(
      f.tool.verifyResultAuthority!({}, result, context),
    ).rejects.toThrow('native_authority_revoked');
    expect(f.domainSave).not.toHaveBeenCalled();
  });
});

describe('BuildNodiaAiWriteToolsUseCase � secure preparation MCP adapters', () => {
  it('keeps the original three bundles and 73 candidate schema documents separate', () => {
    expect(bundles).toHaveLength(3);
    expect(bundles.flatMap((bundle) => bundle.tools)).toHaveLength(73);
    expect(secureBundles).toHaveLength(1);
    expect(secureBundles[0].tools.map((tool) => tool.tool_name).sort()).toEqual(
      securePreparers.map((port) => port.toolName).sort(),
    );
    expect(
      secureBundles[0].tools.every(
        (tool) => tool.kind === 'prepare_secure_flow',
      ),
    ).toBe(true);
  });
  it.each(secureBundles[0].tools)(
    'registers $tool_name as preparation only with the native contract hash',
    (contract) => {
      const f = fixture(contract.tool_name);
      const registry = new NodiaAiToolRegistryUseCase(
        f.builder.execute([f.bundle]),
        'synthetic-secure/1',
      );
      const tool = registry.get(contract.tool_name)!;
      expect(tool.kind).toBe('prepare_secure_flow');
      expect(f.tool.inputSchema.sourceJson).toContain(f.preparer.contractHash);
      expect(tool.actionKeys).toEqual(f.preparer.actionKeys);
      expect(tool.requiredModuleRoutes).toEqual(
        f.preparer.moduleRoutes.length
          ? f.preparer.moduleRoutes
          : ['/tools/nodia-ai'],
      );
      expect(registry.list(tool.requiredModuleRoutes)).toHaveLength(1);
      expect(() =>
        registry.validateInput(tool, { partial: {}, confirmed: true }),
      ).toThrow();
    },
  );
  it('rejects a secure preparer disguised as an ordinary writer or a writer labelled secure', () => {
    const secure = fixture('nodia_secure_flows_prepare_api_key_create');
    expect(() =>
      secure.builder.execute([
        {
          ...secure.bundle,
          tools: [{ ...secure.bundle.tools[0], kind: undefined }],
        },
      ]),
    ).toThrow('nodia_ai:write_contract_invalid');
    const ordinary = fixture();
    expect(() =>
      ordinary.builder.execute([
        {
          ...ordinary.bundle,
          tools: [{ ...ordinary.bundle.tools[0], kind: 'prepare_secure_flow' }],
        },
      ]),
    ).toThrow('nodia_ai:write_contract_invalid');
    const impostor = Object.create(secure.preparer) as NodiaAiProposalPreparer;
    Object.defineProperty(impostor, 'kind', { value: 'nodia_logout' });
    const builder = new BuildNodiaAiWriteToolsUseCase(
      secure.prepare,
      secure.get,
      constructValidate([impostor]),
      commonSource,
      policy,
    );
    expect(() => builder.execute([secure.bundle])).toThrow(
      'nodia_ai:write_contract_invalid',
    );
  });
  it.each(secureBundles[0].tools)(
    'rejects credentials, human channel references and identity injection before persistence for $tool_name',
    async ({ tool_name }) => {
      const f = fixture(tool_name);
      for (const key of [
        'secret',
        'api_key',
        'password',
        'cookie',
        'authorization',
        'native_reference',
        'human_url',
        'flow_id',
        'user_id',
        'session_id',
        'schema_version',
        'command',
      ]) {
        await expect(
          f.tool.handler(
            { partial: { [key]: 'synthetic-rejected' } },
            f.context,
          ),
        ).rejects.toThrow('nodia_ai:invalid_tool_input');
      }
      expect(f.drafts.size).toBe(0);
      expect(f.proposals.size).toBe(0);
      expect(f.domainSave).not.toHaveBeenCalled();
    },
  );
  it('clarifies only safe API-key metadata, continues with CAS and exposes a public secure proposal', async () => {
    const f = fixture('nodia_secure_flows_prepare_api_key_create');
    const first = await f.tool.handler({ partial: {} }, f.context);
    expect(first).toMatchObject({
      status: 'needs_clarification',
      missing_fields: ['provider_id', 'label'],
      draft_revision: 1,
    });
    await expect(
      f.tool.handler(
        {
          partial: { provider_id: '2', label: 'Synthetic added key' },
          draft_id: first.draft_id,
          expected_draft_revision: 2,
        },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:revision_conflict');
    const ready = await f.tool.handler(
      {
        partial: { provider_id: '2', label: 'Synthetic added key' },
        draft_id: first.draft_id,
        expected_draft_revision: 1,
      },
      f.context,
    );
    expect(ready).toMatchObject({
      status: 'ready',
      draft_id: first.draft_id,
      draft_revision: 2,
      missing_fields: [],
      error: null,
    });
    const proposal = ready.proposal as NodiaAiJsonObject;
    expect((proposal.steps as NodiaAiJsonObject[])[0].kind).toBe('secure_flow');
    expect(JSON.stringify(ready)).not.toMatch(
      /native_reference|human_url|encrypted_value|secret_value/,
    );
    expect(f.domainSave).not.toHaveBeenCalled();
  });
  it.each<{ name: string; partial: NodiaAiJsonObject }>([
    {
      name: 'nodia_secure_flows_prepare_api_key_update',
      partial: {
        provider_id: '2',
        key_id: '3',
        label: 'Synthetic revised label',
      },
    },
    {
      name: 'nodia_secure_flows_prepare_connection_login',
      partial: { provider_id: '2', mode: 'token_plan_web' },
    },
  ])(
    'prepares $name without opening a session or submitting a credential',
    async ({ name, partial }) => {
      const f = fixture(name);
      const result = await f.tool.handler({ partial }, f.context);
      expect(result).toMatchObject({
        status: 'ready',
        draft_revision: 1,
        missing_fields: [],
        clarification_keys: [],
        error: null,
      });
      await expect(
        f.tool.verifyResultAuthority!({}, result, f.context),
      ).resolves.toBeUndefined();
      expect(f.domainSave).not.toHaveBeenCalled();
      expect(f.store.publishReady).toHaveBeenCalledOnce();
    },
  );
  it('offers logout to an actor with NodiaAI only and targets the authenticated owner without a nominated user or session', async () => {
    const f = fixture('nodia_secure_flows_prepare_nodia_logout');
    expect(f.preparer.moduleRoutes).toEqual([]);
    expect(f.preparer.actionKeys).toEqual([]);
    expect(f.tool.resourceKey).toBe('nodia_sessions');
    expect(f.tool.requiredModuleRoutes).toEqual(['/tools/nodia-ai']);
    const result = await f.tool.handler({ partial: {} }, f.context);
    expect(result.status).toBe('ready');
    expect([...f.proposals.values()][0].actor_id).toBe(f.identity.userId);
    expect([...f.steps.values()][0][0].command_template).toEqual({
      schema_version: 1,
      command: {},
      origins: {},
    });
    expect(f.domainSave).not.toHaveBeenCalled();
    Object.assign(f.manager, { query: vi.fn(async () => []) });
    await expect(
      f.tool.verifyResultAuthority!({}, result, f.context),
    ).rejects.toThrow('auth:session_expired');
  });
  it('rechecks the native module/action decision for secure preparation and replay', async () => {
    const f = fixture('nodia_secure_flows_prepare_connection_login');
    const result = await f.tool.handler(
      { partial: { provider_id: '2', mode: 'token_plan_agentic' } },
      f.context,
    );
    const previous = f.manager.query;
    f.manager.query = vi.fn(async (sql: string, parameters?: unknown[]) =>
      sql.includes(' AS module')
        ? [{ module: false, action: true }]
        : previous(sql, parameters),
    );
    await expect(
      f.tool.verifyResultAuthority!({}, result, f.context),
    ).rejects.toThrow('nodia_ai:capability_denied');
    expect(f.domainSave).not.toHaveBeenCalled();
  });
  it('binds secure historical clarification to its exact completed receipt and current actor/chat', async () => {
    const f = fixture('nodia_secure_flows_prepare_connection_login');
    const first = await f.tool.handler(
      { partial: { provider_id: '2' } },
      f.context,
    );
    const ready = await f.tool.handler(
      {
        partial: { mode: 'token_plan_web' },
        draft_id: first.draft_id,
        expected_draft_revision: 1,
      },
      f.context,
    );
    expect(ready.status).toBe('ready');
    const call = Object.assign(new NodiaAiToolCall(), {
      id: randomUUID(),
      conversation_id: f.chat.id,
      tool_name: f.tool.toolName,
      state: 'completed',
      public_result: structuredClone(first),
    });
    f.calls.set(call.id, call);
    const context = { ...f.context, toolCallId: call.id };
    await expect(
      f.tool.verifyResultAuthority!({}, first, context),
    ).resolves.toBeUndefined();
    await expect(
      f.tool.verifyResultAuthority!(
        {},
        { ...first, clarification_keys: ['nodia_ai:secret_required'] },
        context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_input');
    f.drafts.get(String(first.draft_id))!.actor_id = '2';
    await expect(
      f.tool.verifyResultAuthority!({}, first, context),
    ).rejects.toThrow('nodia_ai:draft_not_found');
  });
});
