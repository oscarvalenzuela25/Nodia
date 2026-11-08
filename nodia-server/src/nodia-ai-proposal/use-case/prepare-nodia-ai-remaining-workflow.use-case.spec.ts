import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiExecution } from '../../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { nodiaAiFinancialBinding } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import { nodiaAiBoundExecutionBinding } from '../../nodia-ai-execution/types/bound-execution-step.js';
import type { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import type { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiProposalPreparer } from '../types/proposal-preparer.types.js';
import {
  NODIA_AI_WORKFLOW_CATALOG_VERSION,
  type NodiaAiProposalBindingSource,
} from '../types/workflow.types.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from './validate-nodia-ai-proposal.use-case.js';
import { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiRemainingWorkflowUseCase } from './prepare-nodia-ai-remaining-workflow.use-case.js';
import { proposalFixture } from './proposal.fixture.js';

/** Synthetic ports isolate coordinator invariants; native port and PostgreSQL integration have separate suites. */
function fixture() {
  const f = proposalFixture();
  const business = randomUUID();
  Object.assign(f.chat, { retention_epoch: '1' });
  Object.assign(f.preparer, {
    toolName: 'nodia_providers_prepare_create',
    catalogVersion: 'nodia-ai-ai22-business/1',
    moduleRoutes: ['/business'],
    outputKeys: { id: 'provider_id' },
  });
  Object.assign(f.step, {
    tool_name: f.preparer.toolName,
    scope: { business_id: business },
    command_template: {
      schema_version: 1,
      business_id: business,
      command: { name: 'Supplier' },
    },
    preconditions: { destination_business_id: business },
    public_step: {
      ...f.step.public_step,
      tool_name: f.preparer.toolName,
      scope: { business_id: business },
    },
  });
  const child = structuredClone(f.step);
  Object.assign(child, {
    id: randomUUID(),
    position: 2,
    tool_name: 'nodia_provider_contacts_prepare_create',
    command_template: {
      schema_version: 1,
      business_id: business,
      command: { name: 'Old contact', request_key: randomUUID() },
    },
  });
  child.public_step = {
    ...child.public_step,
    step_id: child.id,
    tool_name: child.tool_name,
    depends_on: [f.step.id],
    output_bindings: [
      {
        from_step_id: f.step.id,
        target_field_key: 'provider_id',
        output_key: 'id',
      },
    ],
    changes: [
      {
        field_key: 'provider_id',
        before: null,
        after: null,
        before_present: false,
        after_present: false,
        origin: 'future_step',
      },
    ],
  };
  child.output_bindings = child.public_step
    .output_bindings as NodiaAiJsonObject[];
  const expectedProvider = {
    business_id: business,
    name: 'Supplier',
    tax: 19,
    fields: {},
    is_active: true,
  };
  const provider = {
    ...expectedProvider,
    id: '9',
    updated_at: f.now.toISOString(),
  };
  child.preconditions = {
    destination_business_id: business,
    provider: null,
    target: null,
    future_provider: {
      from_step_id: f.step.id,
      source_contract_hash: f.step.contract_hash,
      expected_provider: expectedProvider,
    },
  };
  const resolvedPreconditions = {
    destination_business_id: business,
    provider,
    target: null,
  };
  const scope = { business_id: business, provider_id: '9' };
  const resolvedTemplate = { ...child.command_template, provider_id: '9' };
  const contact: NodiaAiProposalPreparer = {
    ...f.preparer,
    toolName: child.tool_name,
    bindableFields: { provider_id: 'provider_id' },
    outputKeys: { id: 'provider_contact_id' },
    applyEdits: vi.fn(async (template) => ({
      ...template,
      command: {
        ...(template.command as NodiaAiJsonObject),
        name: 'Corrected',
      },
    })),
    reprepareStored: vi.fn(async (template) => ({
      status: 'ready',
      commandTemplate: template,
      scope,
      preconditions: {
        destination_business_id: business,
        provider_name: 'Supplier',
      },
      publicStep: {
        ...child.public_step,
        scope,
        changes: [
          {
            field_key: 'name',
            before: null,
            before_present: false,
            after: (template.command as NodiaAiJsonObject).name,
            after_present: true,
            origin: 'user',
          },
        ],
      },
    })),
  };
  const validate = new ValidateNodiaAiProposalUseCase(
    [f.preparer, contact],
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    f.policy,
    new CanonicalizeNodiaAiProposalUseCase(f.policy),
  );
  f.revision.catalog_version = NODIA_AI_WORKFLOW_CATALOG_VERSION;
  f.revision.hash = String(
    validate.compile(f.proposal, f.revision, [f.step, child], false).hash,
  );
  f.revision.state = 'confirmed';
  const execution = Object.assign(new NodiaAiExecution(), {
    id: randomUUID(),
    proposal_id: f.proposal.id,
    origin_proposal_id: f.proposal.id,
    origin_proposal_revision: 1,
    conversation_id: f.chat.id,
    origin_conversation_id: f.chat.id,
    actor_id: f.actor.actorId,
    chat_owner_id: f.chat.owner_id,
    proposal_hash: f.revision.hash,
    catalog_version: f.revision.catalog_version,
    revision: 5,
    state: 'partially_completed',
    retention_epoch: '1',
    completed_at: null,
    minimal_scope: {
      schema_version: 1,
      steps: [f.step, child].map((source) => ({
        step_id: source.id,
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
      })),
    },
  });
  const makeStatus = (source: NodiaAiProposalStep) =>
    Object.assign(new NodiaAiExecutionStep(), {
      id: source.id,
      source_step_id: source.id,
      execution_id: execution.id,
      position: source.position,
      tool_name: source.tool_name,
      template_hash: validate.hash({
        command_template: source.command_template,
        output_bindings: source.output_bindings,
        preconditions: source.preconditions,
      }),
      bound_command_hash: null,
      bound_command: null,
      minimal_scope: source.scope,
      minimal_receipt: null,
      completed_at: null,
      dispatched_at: null,
      error_code: null,
      recovery_descriptor: null,
    });
  const completed = Object.assign(makeStatus(f.step), {
    state: 'completed',
    completed_at: f.now,
    dispatched_at: f.now,
    minimal_receipt: {
      schema_version: 1,
      resource_key: 'providers',
      operation: 'create',
      resource_id: '9',
      business_id: business,
    },
    bound_command_hash: validate.hash(nodiaAiFinancialBinding(f.step)),
  });
  const failed = Object.assign(makeStatus(child), {
    state: 'failed',
    bound_command: {
      command_template: resolvedTemplate,
      scope,
      preconditions: resolvedPreconditions,
    },
    bound_command_hash: validate.hash(
      nodiaAiBoundExecutionBinding(
        {
          ...child,
          scope,
          command_template: resolvedTemplate,
          preconditions: resolvedPreconditions,
        },
        true,
      ),
    ),
    error_code: 'nodia_ai:execution_failed',
    recovery_descriptor: {
      schema_version: 1,
      kind: 'local_transaction_rolled_back',
    },
  });
  const statuses = [completed, failed];
  const job = Object.assign(new NodiaAiJob(), {
    id: randomUUID(),
    execution_id: execution.id,
    conversation_id: f.chat.id,
    kind: 'execution',
    state: 'failed',
    stage_key: 'execution_step',
    run_id: null,
    lease_owner: null,
    lease_until: null,
    fence: '2',
  });
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async (sql: string) => {
      if (
        sql === 'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE'
      )
        return [{ id: f.chat.id }];
      if (sql.includes('RETURNING next_event_seq::text AS seq'))
        return [{ seq: '1' }];
      return [];
    }),
    getRepository: (target: unknown) => {
      if (target === NodiaAiExecution)
        return {
          findOneBy: async () => execution,
          findOne: async () => execution,
        };
      if (target === NodiaAiExecutionStep)
        return { find: async () => statuses };
      if (target === NodiaAiJob) return { find: async () => [job] };
      throw new Error('Unexpected repository');
    },
  } as unknown as EntityManager;
  const context = {
    manager,
    actor: f.actor,
    conversationId: f.chat.id,
    moduleRoutes: ['/business'],
  };
  const get = {
    load: vi.fn(async () => ({
      proposal: f.proposal,
      revision: f.revision,
      steps: [f.step, child],
      now: f.now,
      chat: f.chat,
      context,
    })),
  };
  const store = { ...f.store, create: vi.fn() };
  const useCase = new PrepareNodiaAiRemainingWorkflowUseCase(
    store as unknown as NodiaAiProposalService,
    get as unknown as GetNodiaAiProposalUseCase,
    validate,
    {
      step: PrepareNodiaAiProposalUseCase.prototype.step,
    } as PrepareNodiaAiProposalUseCase,
    f.policy,
  );
  const input = {
    execution_id: execution.id,
    expected_execution_revision: execution.revision,
    edits: [{ step_id: child.id, field_key: 'name', value: 'Corrected' }],
  };
  return {
    ...f,
    manager,
    validate,
    context,
    contact,
    child,
    completed,
    failed,
    statuses,
    execution,
    job,
    get,
    store,
    useCase,
    input,
  };
}

describe('Correct only the remaining work after a proven local rollback', () => {
  it('prepares a fresh literal contact from the verified completed receipt when its parent changed before first binding', async () => {
    const f = fixture();
    Object.assign(f.failed, {
      bound_command: null,
      bound_command_hash: null,
      error_code: 'nodia_ai:preconditions_changed',
    });
    const strictBind = vi.fn(async () => {
      throw new Error('Old parent snapshot must remain stale');
    });
    Object.assign(f.contact, { bindOutputs: strictBind });
    const originalPrepare = vi
      .mocked(f.contact.reprepareStored!)
      .getMockImplementation()!;
    vi.mocked(f.contact.reprepareStored!).mockImplementation(
      async (...args) => {
        const prepared = await originalPrepare(...args);
        if (prepared.status !== 'ready')
          throw new Error('Fixture expected ready');
        return {
          ...prepared,
          preconditions: {
            ...prepared.preconditions,
            provider_name: 'Supplier renamed after commit',
          },
        };
      },
    );
    const originalKey = (f.child.command_template.command as NodiaAiJsonObject)
      .request_key;
    const completedBefore = JSON.stringify(f.completed);
    await f.useCase.execute(f.manager, f.identity, f.input);
    const saved = f.store.create.mock.calls[0] as unknown as [
      unknown,
      unknown,
      unknown,
      NodiaAiProposalStep[],
    ];
    const step = saved[3][0];
    expect(strictBind).not.toHaveBeenCalled();
    expect(step.command_template.provider_id).toBe('9');
    expect(
      (step.command_template.command as NodiaAiJsonObject).request_key,
    ).toBe(originalKey);
    expect(step.scope).toEqual({ ...f.child.scope, provider_id: '9' });
    expect(step.output_bindings).toEqual([]);
    expect(step.preconditions.provider_name).toBe(
      'Supplier renamed after commit',
    );
    expect(JSON.stringify(f.completed)).toBe(completedBefore);
  });
  it('revises the whole pending suffix when the first step failed and remaps a later symbolic dependency', async () => {
    const f = fixture();
    Object.assign(f.completed, {
      state: 'failed',
      completed_at: null,
      dispatched_at: null,
      minimal_receipt: null,
      error_code: 'nodia_ai:execution_failed',
      recovery_descriptor: {
        schema_version: 1,
        kind: 'local_transaction_rolled_back',
      },
    });
    Object.assign(f.failed, {
      state: 'ready',
      bound_command: null,
      bound_command_hash: null,
      error_code: null,
      recovery_descriptor: null,
    });
    f.execution.state = 'failed';
    f.input.edits[0].step_id = f.step.id;
    Object.assign(f.preparer, {
      applyEdits: vi.fn(async (template: NodiaAiJsonObject) => ({
        ...template,
        command: { name: 'Corrected' },
      })),
      reprepareStored: vi.fn(async (template: NodiaAiJsonObject) => ({
        status: 'ready',
        commandTemplate: template,
        scope: f.step.scope,
        preconditions: f.step.preconditions,
        publicStep: f.step.public_step,
      })),
    });
    const reprepareWithBindings = vi.fn(
      async (
        template: NodiaAiJsonObject,
        bindings: readonly NodiaAiProposalBindingSource[],
      ) => ({
        status: 'ready' as const,
        commandTemplate: { ...template, parent_ref: bindings[0].from_step_id },
        scope: f.child.scope,
        preconditions: {
          source_name: (
            bindings[0].source.commandTemplate.command as NodiaAiJsonObject
          ).name,
        },
        publicStep: f.child.public_step,
      }),
    );
    Object.assign(f.contact, { reprepareWithBindings });
    await f.useCase.execute(f.manager, f.identity, f.input);
    const saved = f.store.create.mock.calls[0] as unknown as [
      unknown,
      unknown,
      unknown,
      NodiaAiProposalStep[],
    ];
    expect(saved[3]).toHaveLength(2);
    expect(saved[3][1].output_bindings[0].from_step_id).toBe(saved[3][0].id);
    expect(saved[3][1].command_template.parent_ref).toBe(saved[3][0].id);
    expect(saved[3][1].preconditions.source_name).toBe('Corrected');
    expect(f.contact.reprepareStored).not.toHaveBeenCalled();
  });
  it('creates a new exact proposal for the failed contact, keeps the completed supplier receipt and revokes only the old pending work', async () => {
    const f = fixture();
    const completedBefore = JSON.stringify(f.completed);
    const result = await f.useCase.execute(f.manager, f.identity, f.input);
    const projection = result.proposal as NodiaAiJsonObject;
    expect(projection.proposal_id).not.toBe(f.proposal.id);
    expect(projection.steps).toHaveLength(1);
    const saved = f.store.create.mock.calls[0] as unknown as [
      unknown,
      { prior_execution_id: string },
      unknown,
      NodiaAiProposalStep[],
    ];
    expect(saved[1].prior_execution_id).toBe(f.execution.id);
    expect(saved[3][0].command_template.provider_id).toBe('9');
    expect(
      (saved[3][0].command_template.command as NodiaAiJsonObject).name,
    ).toBe('Corrected');
    expect(saved[3][0].output_bindings).toEqual([]);
    expect(JSON.stringify(f.completed)).toBe(completedBefore);
    expect(f.contact.reprepareStored).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.manager.query).toHaveBeenCalledWith(
      expect.stringContaining("state<>'completed'"),
      expect.any(Array),
    );
    expect(f.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE nodia_ai_execution_grants'),
      expect.any(Array),
    );
  });
  it.each([
    'unknown',
    'completed',
    'cancelled',
    'revision',
    'foreign_actor',
    'epoch',
    'busy',
    'missing_rollback',
    'uncertain_dispatch',
    'forged_receipt',
    'wrong_template_hash',
    'wrong_bound_hash',
    'active_attempt',
    'job_leased',
    'completed_edit',
    'bound_target_edit',
    'duplicate_edit',
    'not_ready',
  ])(
    'rejects unsafe correction %s without creating a proposal or changing previous work',
    async (kind) => {
      const f = fixture();
      if (['unknown', 'completed', 'cancelled'].includes(kind))
        f.execution.state = kind;
      if (kind === 'revision') f.input.expected_execution_revision--;
      if (kind === 'foreign_actor') f.execution.actor_id = '2';
      if (kind === 'epoch') f.execution.retention_epoch = '2';
      if (kind === 'busy') f.chat.active_job_id = randomUUID() as never;
      if (kind === 'missing_rollback') f.failed.recovery_descriptor = null;
      if (kind === 'uncertain_dispatch') f.failed.dispatched_at = f.now;
      if (kind === 'forged_receipt')
        f.completed.minimal_receipt!.resource_id = 'not-an-id';
      if (kind === 'wrong_template_hash')
        f.failed.template_hash = '0'.repeat(64);
      if (kind === 'wrong_bound_hash')
        f.failed.bound_command_hash = '0'.repeat(64);
      if (kind === 'active_attempt')
        vi.mocked(f.manager.query).mockResolvedValue([{ id: randomUUID() }]);
      if (kind === 'job_leased') f.job.lease_owner = randomUUID();
      if (kind === 'completed_edit') f.input.edits[0].step_id = f.step.id;
      if (kind === 'bound_target_edit')
        f.input.edits[0].field_key = 'provider_id';
      if (kind === 'duplicate_edit')
        f.input.edits.push({ ...f.input.edits[0] });
      if (kind === 'not_ready')
        vi.mocked(f.contact.reprepareStored!).mockResolvedValue({
          status: 'needs_clarification',
          partial: {},
          missingFields: ['email'],
          clarificationKeys: [],
        });
      await expect(
        f.useCase.execute(f.manager, f.identity, f.input),
      ).rejects.toThrow();
      expect(f.store.create).not.toHaveBeenCalled();
      const writes = vi
        .mocked(f.manager.query)
        .mock.calls.filter(([sql]) => (sql as string).startsWith('UPDATE '));
      expect(writes).toEqual([]);
    },
  );
  it('binds the prior execution to the proposal hash while preserving legacy null/undefined compatibility', () => {
    const f = fixture();
    const a = f.validate.compile(
      f.proposal,
      f.revision,
      [f.step, f.child],
      false,
    ).hash;
    f.proposal.prior_execution_id = null;
    expect(
      f.validate.compile(f.proposal, f.revision, [f.step, f.child], false).hash,
    ).toBe(a);
    f.proposal.prior_execution_id = f.execution.id;
    expect(
      f.validate.compile(f.proposal, f.revision, [f.step, f.child], false).hash,
    ).not.toBe(a);
  });
});
