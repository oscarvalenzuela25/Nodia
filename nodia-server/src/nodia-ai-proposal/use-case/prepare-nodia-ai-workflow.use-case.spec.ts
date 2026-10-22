import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { NodiaAiDraft } from '../entities/nodia-ai-draft.entity.js';
import type { NodiaAiProposalBindingSource } from '../types/workflow.types.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION } from '../types/workflow.types.js';
import { proposalFixture } from './proposal.fixture.js';
import { ValidateNodiaAiProposalUseCase } from './validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiWorkflowUseCase } from './prepare-nodia-ai-workflow.use-case.js';

function fixture() {
  const f = proposalFixture();
  Object.assign(f.preparer, {
    bindableFields: { parent_id: 'record_id' },
    outputKeys: { id: 'record_id' },
  });
  const validate = new ValidateNodiaAiProposalUseCase(
    [f.preparer],
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
  const first = Object.assign(new NodiaAiDraft(), {
    id: randomUUID(),
    conversation_id: f.chat.id,
    actor_id: f.actor.actorId,
    tool_name: f.preparer.toolName,
    catalog_version: f.preparer.catalogVersion,
    revision: 1,
    state: 'ready',
    claimed_proposal_id: f.proposal.id,
    partial_command: { name: 'Obsolete draft value' },
    clarifications: {},
    scope: f.step.scope,
  });
  const second = Object.assign(new NodiaAiDraft(), {
    ...first,
    id: randomUUID(),
    state: 'incomplete',
    claimed_proposal_id: null,
    partial_command: { name: 'Contact' },
    clarifications: { missing_fields: ['parent_id'] },
  });
  const drafts = [first, second];
  const update = vi.fn(async () => ({ affected: 1 }));
  const repository = { update };
  Object.assign(f.manager, { getRepository: () => repository });
  const create = vi.fn();
  const store = {
    ...f.store,
    create,
    lockWorkflowDrafts: vi.fn(async () => drafts),
    claimWorkflowDrafts: vi.fn(async () => undefined),
  };
  const prepareWithBindings = vi.fn(
    async (
      partial: NodiaAiJsonObject,
      bindings: readonly NodiaAiProposalBindingSource[],
    ) => ({
      status: 'ready' as const,
      commandTemplate: { ...partial, parent_ref: bindings[0].from_step_id },
      scope: f.step.scope,
      preconditions: { source_name: bindings[0].source.commandTemplate.name },
      publicStep: {
        ...f.step.public_step,
        changes: [
          {
            field_key: 'name',
            before: null,
            before_present: false,
            after: partial.name,
            after_present: true,
            origin: 'user',
          },
          {
            field_key: 'parent_id',
            before: null,
            before_present: false,
            after: null,
            after_present: false,
            origin: 'future_step',
          },
        ],
      },
    }),
  );
  Object.assign(f.preparer, { prepareWithBindings });
  const prepare = {
    step: PrepareNodiaAiProposalUseCase.prototype.step,
  } as PrepareNodiaAiProposalUseCase;
  const useCase = new PrepareNodiaAiWorkflowUseCase(
    store as unknown as NodiaAiProposalService,
    f.authorizeChat as never,
    f.authorize as never,
    validate,
    prepare,
    f.policy,
  );
  const input = {
    catalog_version: NODIA_AI_WORKFLOW_CATALOG_VERSION,
    draft_ids: drafts.map((draft) => draft.id),
    bindings: [
      {
        draft_id: second.id,
        target_field_key: 'parent_id',
        from_draft_id: first.id,
        output_key: 'id',
      },
    ],
  };
  return {
    ...f,
    validate,
    store,
    first,
    second,
    drafts,
    update,
    prepareWithBindings,
    useCase,
    input,
  };
}

describe('Claim NodiaAI drafts into one dependent proposal', () => {
  it('admits only a backend-accredited callback during its active chat job', async () => {
    const f = fixture();
    const jobId = randomUUID();
    Object.assign(f.chat, { active_job_id: jobId, retention_epoch: '1' });
    const callback = {
      runId: randomUUID(),
      toolCallId: randomUUID(),
      attemptId: randomUUID(),
    };
    vi.mocked(f.manager.query).mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT t.id FROM nodia_ai_tool_calls t')
        ? [{ id: callback.toolCallId }]
        : [],
    );
    const result = await f.useCase.execute(
      f.manager,
      f.identity,
      f.chat.id,
      f.input,
      callback,
    );
    expect(result.status).toBe('ready');
    expect(f.manager.query).toHaveBeenCalledWith(
      expect.stringContaining(
        "a.phase='dispatch_armed' AND a.ended_at IS NULL",
      ),
      [
        callback.toolCallId,
        callback.runId,
        f.chat.id,
        jobId,
        callback.attemptId,
        f.actor.actorId,
        '1',
      ],
    );
    expect(f.store.create).toHaveBeenCalledOnce();
  });
  it('does not turn an unaccredited internal callback into a general busy bypass', async () => {
    const f = fixture();
    Object.assign(f.chat, {
      active_job_id: randomUUID(),
      retention_epoch: '1',
    });
    await expect(
      f.useCase.execute(f.manager, f.identity, f.chat.id, f.input, {
        runId: randomUUID(),
        toolCallId: randomUUID(),
        attemptId: randomUUID(),
      }),
    ).rejects.toThrow('nodia_ai:conversation_busy');
    expect(f.store.lockWorkflowDrafts).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it('rejects a secure flow in a dependent set before claiming any draft', async () => {
    const f = fixture();
    f.first.tool_name = 'nodia_secure_flows_prepare_connection_login';
    vi.spyOn(f.validate, 'preparer').mockReturnValue(f.preparer);
    await expect(
      f.useCase.execute(f.manager, f.identity, f.chat.id, f.input),
    ).rejects.toThrow('nodia_ai:secure_flow_single_step_required');
    expect(f.store.claimWorkflowDrafts).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
  });

  it('freezes current edited source, previews future reference, supersedes individual and claims drafts in the same transaction', async () => {
    const f = fixture();
    const result = await f.useCase.execute(
      f.manager,
      f.identity,
      f.chat.id,
      f.input,
    );
    expect(result.status).toBe('ready');
    const projection = result.proposal as NodiaAiJsonObject;
    const steps = projection.steps as NodiaAiJsonObject[];
    expect(projection.catalog_version).toBe(NODIA_AI_WORKFLOW_CATALOG_VERSION);
    expect(steps).toHaveLength(2);
    expect(steps[1].depends_on).toEqual([steps[0].step_id]);
    expect(steps[1].output_bindings).toEqual([
      {
        target_field_key: 'parent_id',
        from_step_id: steps[0].step_id,
        output_key: 'id',
      },
    ]);
    expect(
      f.prepareWithBindings.mock.calls[0][1][0].source.commandTemplate.name,
    ).toBe('Original');
    expect(f.update).toHaveBeenCalledWith(
      expect.objectContaining({ proposal_id: f.proposal.id, state: 'ready' }),
      { state: 'superseded' },
    );
    expect(f.store.claimWorkflowDrafts).toHaveBeenCalledWith(
      f.manager,
      f.drafts,
      projection.proposal_id,
      f.now,
    );
    expect(f.store.create).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
    expect(f.preparer.applyEdits).not.toHaveBeenCalled();
  });
  it('keeps requested order even when storage returns drafts in lock order', async () => {
    const f = fixture();
    f.store.lockWorkflowDrafts.mockResolvedValue([f.second, f.first]);
    await f.useCase.execute(f.manager, f.identity, f.chat.id, f.input);
    const saved = f.store.create.mock.calls[0] as unknown as [
      unknown,
      unknown,
      unknown,
      { command_template: NodiaAiJsonObject }[],
    ];
    expect(saved[3][0].command_template.name).toBe('Original');
    expect(saved[3][1].command_template.name).toBe('Contact');
  });
  it('never extends an individual source expiration', async () => {
    const f = fixture();
    f.revision.expires_at = new Date(f.now.getTime() + 1200);
    f.revision.hash = String(
      f.validate.compile(f.proposal, f.revision, [f.step], false).hash,
    );
    const result = await f.useCase.execute(
      f.manager,
      f.identity,
      f.chat.id,
      f.input,
    );
    expect((result.proposal as NodiaAiJsonObject).expires_at).toBe(
      f.revision.expires_at.toISOString(),
    );
  });
  it.each([
    'unknown',
    'duplicate',
    'foreign_actor',
    'foreign_chat',
    'claimed',
    'cancelled',
    'catalog',
    'busy',
    'inactive_transaction',
  ])(
    'rejects unavailable draft case %s before creating any proposal',
    async (kind) => {
      const f = fixture();
      if (kind === 'unknown')
        f.store.lockWorkflowDrafts.mockResolvedValue([f.first]);
      if (kind === 'duplicate') f.input.draft_ids[1] = f.first.id;
      if (kind === 'foreign_actor') f.second.actor_id = '2';
      if (kind === 'foreign_chat') f.second.conversation_id = randomUUID();
      if (kind === 'claimed') f.second.state = 'claimed';
      if (kind === 'cancelled') f.second.state = 'cancelled';
      if (kind === 'catalog') f.second.catalog_version = 'stale/1';
      if (kind === 'busy') f.chat.active_job_id = randomUUID() as never;
      if (kind === 'inactive_transaction')
        (
          f.manager.queryRunner as { isTransactionActive: boolean }
        ).isTransactionActive = false;
      await expect(
        f.useCase.execute(f.manager, f.identity, f.chat.id, f.input),
      ).rejects.toThrow();
      expect(f.store.create).not.toHaveBeenCalled();
      expect(f.store.claimWorkflowDrafts).not.toHaveBeenCalled();
      expect(f.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    'self',
    'future',
    'foreign_source',
    'foreign_target',
    'duplicate_target',
    'unknown_target',
    'unknown_output',
    'type_mismatch',
  ])('rejects invalid typed dependency %s', async (kind) => {
    const f = fixture();
    const binding = f.input.bindings[0];
    if (kind === 'self') binding.from_draft_id = f.second.id;
    if (kind === 'future') {
      binding.from_draft_id = f.second.id;
      binding.draft_id = f.first.id;
    }
    if (kind === 'foreign_source') binding.from_draft_id = randomUUID();
    if (kind === 'foreign_target') binding.draft_id = randomUUID();
    if (kind === 'duplicate_target') f.input.bindings.push({ ...binding });
    if (kind === 'unknown_target') binding.target_field_key = 'sql';
    if (kind === 'unknown_output') binding.output_key = 'arbitrary.json.path';
    if (kind === 'type_mismatch')
      Object.assign(f.preparer, { bindableFields: { parent_id: 'other_id' } });
    await expect(
      f.useCase.execute(f.manager, f.identity, f.chat.id, f.input),
    ).rejects.toThrow();
    expect(f.prepareWithBindings).not.toHaveBeenCalled();
    expect(f.store.create).not.toHaveBeenCalled();
  });
  it.each([
    'confirmed',
    'superseded',
    'expired',
    'execution',
    'material_change',
    'authority',
    'missing_other_field',
    'unsupported_binding',
  ])('rejects %s before superseding any individual proposal', async (kind) => {
    const f = fixture();
    if (kind === 'confirmed' || kind === 'superseded') f.revision.state = kind;
    if (kind === 'expired') f.revision.expires_at = new Date(f.now);
    if (kind === 'execution')
      vi.mocked(f.manager.query).mockImplementation(async (sql: string) =>
        sql.startsWith('SELECT id FROM nodia_ai_executions')
          ? [{ id: randomUUID() }]
          : [],
      );
    if (kind === 'material_change')
      vi.mocked(f.preparer.verifyPreconditions).mockRejectedValue(
        new Error('changed'),
      );
    if (kind === 'authority')
      vi.mocked(f.preparer.verifyAuthority).mockRejectedValue(
        new Error('forbidden'),
      );
    if (kind === 'unsupported_binding')
      Object.assign(f.preparer, { prepareWithBindings: undefined });
    if (kind === 'missing_other_field')
      f.prepareWithBindings.mockResolvedValue({
        status: 'needs_clarification',
        missingFields: ['name'],
        clarificationKeys: [],
        partial: {},
      } as never);
    await expect(
      f.useCase.execute(f.manager, f.identity, f.chat.id, f.input),
    ).rejects.toThrow();
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
  it('supports an independent ready draft without converting its literal command into a future reference', async () => {
    const f = fixture();
    f.input.draft_ids = [f.first.id];
    f.input.bindings = [];
    f.store.lockWorkflowDrafts.mockResolvedValue([f.first]);
    const result = await f.useCase.execute(
      f.manager,
      f.identity,
      f.chat.id,
      f.input,
    );
    expect(
      ((result.proposal as NodiaAiJsonObject).steps as NodiaAiJsonObject[])[0]
        .output_bindings,
    ).toEqual([]);
    expect(f.prepareWithBindings).not.toHaveBeenCalled();
  });
  it('rejects getters and unknown fields without evaluating behavior', async () => {
    const f = fixture();
    const behavior = vi.fn(() => f.input.draft_ids);
    Object.defineProperty(f.input, 'draft_ids', {
      get: behavior,
      enumerable: true,
    });
    await expect(
      f.useCase.execute(f.manager, f.identity, f.chat.id, f.input),
    ).rejects.toThrow();
    expect(behavior).not.toHaveBeenCalled();
    expect(f.store.lockWorkflowDrafts).not.toHaveBeenCalled();
  });
});
