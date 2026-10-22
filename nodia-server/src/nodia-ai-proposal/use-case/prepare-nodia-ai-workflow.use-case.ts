import { nodiaAiSecureOperationIdentity } from '../types/secure-operation.types.js';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import type { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiDraft } from '../entities/nodia-ai-draft.entity.js';
import type { ProposalPreparerContext } from '../types/proposal-preparer.types.js';
import {
  NODIA_AI_WORKFLOW_CATALOG_VERSION,
  type NodiaAiWorkflowPrepareInput,
  type NodiaAiProposalBindingSource,
} from '../types/workflow.types.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from './validate-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';

@Injectable()
export class PrepareNodiaAiWorkflowUseCase {
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly authorizeChat: AuthorizeNodiaAiConversationUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    private readonly prepare: PrepareNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  /** Internal application port, deliberately absent from the model's published registry. */
  async execute(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    conversationId: string,
    raw: unknown,
    callback?: { runId: string; toolCallId: string; attemptId: string },
  ): Promise<NodiaAiJsonObject> {
    if (!manager.queryRunner?.isTransactionActive)
      throw new BadRequestException('authorization:transaction_required');
    this.validate.assert('WorkflowPrepareInput', raw);
    const input = raw as NodiaAiWorkflowPrepareInput;
    if (input.catalog_version !== NODIA_AI_WORKFLOW_CATALOG_VERSION)
      throw new BadRequestException('nodia_ai:catalog_changed');
    if (
      input.draft_ids.length > this.policy.budget.steps_per_proposal ||
      (input.bindings?.length ?? 0) > this.policy.results.json_collection_items
    )
      throw new BadRequestException('nodia_ai:execution_limit');
    await lockAuthority(
      manager,
      false,
      this.policy.timing.read_query_seconds * 1000,
    );
    const { actor, chat, now } = await this.authorizeChat.execute(
      manager,
      identity,
      conversationId,
      'write',
      'proposal',
    );
    if (callback) {
      // This capability comes exclusively from the fenced MCP dispatcher, never tool arguments.
      // The validated receipt and the original armed attempt share the caller's transaction.
      const rows: { id: string }[] = await manager.query(
        `SELECT t.id FROM nodia_ai_tool_calls t
         JOIN nodia_ai_runs r ON r.id=t.run_id AND r.conversation_id=t.conversation_id
         JOIN nodia_ai_jobs j ON j.id=$4 AND j.run_id=r.id AND j.conversation_id=r.conversation_id
         JOIN nodia_ai_job_attempts a ON a.id=$5 AND a.job_id=j.id
           AND a.fence=j.fence AND a.stage_key=j.stage_key AND a.stage_seq=j.stage_seq
         WHERE t.id=$1 AND t.run_id=$2 AND t.conversation_id=$3
           AND t.tool_name='nodia_workflows_prepare' AND t.state='validated'
           AND r.actor_id=$6 AND r.state='running' AND r.retention_epoch=$7
           AND r.deadline_at>clock_timestamp() AND j.deadline_at>clock_timestamp()
           AND a.phase='dispatch_armed' AND a.ended_at IS NULL`,
        [
          callback.toolCallId,
          callback.runId,
          chat.id,
          chat.active_job_id,
          callback.attemptId,
          actor.actorId,
          chat.retention_epoch,
        ],
      );
      if (rows.length !== 1)
        throw new ConflictException('nodia_ai:conversation_busy');
    } else if (chat.active_job_id)
      throw new ConflictException('nodia_ai:conversation_busy');
    const locked = await this.store.lockWorkflowDrafts(
      manager,
      chat.id,
      input.draft_ids,
    );
    const byId = new Map(locked.map((draft) => [draft.id, draft]));
    if (locked.length !== input.draft_ids.length) return this.invalid();
    const drafts = input.draft_ids.map((id) => byId.get(id)!);
    for (const draft of drafts) {
      if (
        draft.actor_id !== actor.actorId ||
        draft.conversation_id !== chat.id ||
        !['ready', 'incomplete'].includes(draft.state)
      )
        throw new ConflictException('nodia_ai:workflow_draft_unavailable');
      const port = this.validate.preparer(draft.tool_name);
      if (port.catalogVersion !== draft.catalog_version)
        throw new BadRequestException('nodia_ai:catalog_changed');
      await this.authorize.execute(
        identity,
        { moduleRoutes: port.moduleRoutes, actionKeys: port.actionKeys },
        manager,
      );
    }
    if (drafts.some((draft) => nodiaAiSecureOperationIdentity(draft.tool_name)))
      throw new BadRequestException(
        'nodia_ai:secure_flow_single_step_required',
      );
    const position = new Map(drafts.map((draft, index) => [draft.id, index]));
    const ids = new Map(drafts.map((draft) => [draft.id, randomUUID()]));
    const targets = new Set<string>();
    for (const binding of input.bindings ?? []) {
      const target = position.get(binding.draft_id);
      const source = position.get(binding.from_draft_id);
      const pair = `${binding.draft_id}:${binding.target_field_key}`;
      if (
        target === undefined ||
        source === undefined ||
        source >= target ||
        targets.has(pair)
      )
        return this.invalid();
      const receiving = this.validate.preparer(drafts[target].tool_name);
      const producing = this.validate.preparer(drafts[source].tool_name);
      if (
        !Object.hasOwn(receiving.bindableFields, binding.target_field_key) ||
        !Object.hasOwn(producing.outputKeys, binding.output_key) ||
        receiving.bindableFields[binding.target_field_key] !==
          producing.outputKeys[binding.output_key]
      )
        return this.invalid();
      targets.add(pair);
    }
    const context: ProposalPreparerContext = {
      manager,
      actor,
      conversationId: chat.id,
      moduleRoutes: actor.modules.map((module) => module.route),
      statementTimeoutMs: this.policy.timing.read_query_seconds * 1000,
      maxCollectionItems: this.policy.results.json_collection_items,
    };
    const proposal = Object.assign(new NodiaAiProposal(), {
      id: randomUUID(),
      conversation_id: chat.id,
      actor_id: actor.actorId,
      current_revision: 1,
      created_at: now,
    });
    let expiry = Math.min(
      chat.expires_at.getTime(),
      now.getTime() + this.policy.timing.proposal_seconds * 1000,
    );
    const previous: {
      draft: NodiaAiDraft;
      proposal: NodiaAiProposal;
      revision: NodiaAiProposalRevision;
    }[] = [];
    const steps: NodiaAiProposalStep[] = [];
    for (const [index, draft] of drafts.entries()) {
      const port = this.validate.preparer(draft.tool_name);
      const bindings: NodiaAiProposalBindingSource[] = (input.bindings ?? [])
        .filter((binding) => binding.draft_id === draft.id)
        .map((item) => ({
          target_field_key: item.target_field_key,
          from_step_id: ids.get(item.from_draft_id)!,
          output_key: item.output_key,
          source: storedStep(steps[position.get(item.from_draft_id)!]),
        }));
      let prepared;
      if (draft.state === 'ready') {
        if (bindings.length || !draft.claimed_proposal_id)
          return this.invalid();
        const old = await this.store.proposal(
          manager,
          draft.claimed_proposal_id,
        );
        if (
          !old ||
          old.conversation_id !== chat.id ||
          old.actor_id !== actor.actorId ||
          previous.some((item) => item.proposal.id === old.id)
        )
          return this.invalid();
        const revision = await this.store.revision(
          manager,
          old.id,
          old.current_revision,
        );
        const originals = await this.store.steps(
          manager,
          old.id,
          old.current_revision,
        );
        if (
          !revision ||
          revision.state !== 'ready' ||
          originals.length !== 1 ||
          originals[0].tool_name !== draft.tool_name ||
          originals[0].output_bindings.length
        )
          throw new ConflictException('nodia_ai:workflow_draft_unavailable');
        if (now >= revision.expires_at)
          throw new GoneException('nodia_ai:proposal_expired');
        this.validate.compile(old, revision, originals);
        const executions: { id: string }[] = await manager.query(
          'SELECT id FROM nodia_ai_executions WHERE origin_proposal_id=$1 OR proposal_id=$1 LIMIT 1',
          [old.id],
        );
        if (executions.length)
          throw new ConflictException('nodia_ai:workflow_draft_unavailable');
        const original = storedStep(originals[0]);
        await port.verifyAuthority(original, context);
        await port.verifyPreconditions(original, context);
        prepared = {
          commandTemplate: original.commandTemplate,
          scope: original.scope,
          preconditions: original.preconditions,
          publicStep: original.publicStep,
        };
        expiry = Math.min(expiry, revision.expires_at.getTime());
        previous.push({ draft, proposal: old, revision });
      } else {
        if (!bindings.length || !port.prepareWithBindings)
          return this.invalid();
        const candidate = await port.prepareWithBindings(
          draft.partial_command,
          bindings,
          context,
        );
        if (candidate.status !== 'ready')
          throw new BadRequestException(
            'nodia_ai:proposal_needs_clarification',
          );
        prepared = candidate;
      }
      const publicBindings = bindings.map(
        ({ source: _source, ...binding }) => binding,
      );
      prepared = {
        ...prepared,
        publicStep: {
          ...prepared.publicStep,
          depends_on: [
            ...new Set(publicBindings.map((binding) => binding.from_step_id)),
          ],
          output_bindings: publicBindings,
        },
      };
      const step = this.prepare.step(
        proposal.id,
        1,
        index + 1,
        port.toolName,
        port.contractHash,
        prepared,
        ids.get(draft.id),
      );
      await port.verifyAuthority(storedStep(step), context);
      steps.push(step);
    }
    const revision = Object.assign(new NodiaAiProposalRevision(), {
      proposal_id: proposal.id,
      revision: 1,
      state: 'ready',
      hash: '',
      catalog_version: NODIA_AI_WORKFLOW_CATALOG_VERSION,
      canonicalization_version: 'jcs-rfc8785/1',
      created_at: now,
      expires_at: new Date(expiry),
    });
    const projection = this.validate.compile(proposal, revision, steps, false);
    revision.hash = String(projection.hash);
    const result: NodiaAiJsonObject = {
      status: 'ready',
      draft_id: null,
      proposal: projection,
      missing_fields: [],
      clarification_keys: [],
      error: null,
    };
    this.validate.assert('PreparationResult', result);
    // All checks above finish before the first mutation; all following writes share the caller transaction.
    await this.store.create(manager, proposal, revision, steps);
    for (const old of previous) {
      const result = await manager
        .getRepository(NodiaAiProposalRevision)
        .update(
          {
            proposal_id: old.proposal.id,
            revision: old.revision.revision,
            state: 'ready',
          },
          { state: 'superseded' },
        );
      if (result.affected !== 1)
        throw new ConflictException('nodia_ai:revision_conflict');
    }
    await this.store.claimWorkflowDrafts(manager, drafts, proposal.id, now);
    await this.store.publishReady(
      manager,
      proposal,
      projection,
      [
        ...new Set(
          drafts.flatMap(
            (draft) => this.validate.preparer(draft.tool_name).moduleRoutes,
          ),
        ),
      ],
      this.policy.results.outbox_events_per_activity,
    );
    return result;
  }
  private invalid(): never {
    throw new BadRequestException('nodia_ai:invalid_input');
  }
}
