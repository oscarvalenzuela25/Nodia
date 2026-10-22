import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiExecution } from '../../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import {
  boundNodiaAiProposalStep,
  nodiaAiBoundExecutionBinding,
} from '../../nodia-ai-execution/types/bound-execution-step.js';
import { nextNodiaAiExecutionStep } from '../../nodia-ai-execution/types/sequential-execution.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import type { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import type {
  PreparedProposalStep,
  ProposalFieldEdit,
  StoredProposalStep,
} from '../types/proposal-preparer.types.js';
import type { NodiaAiProposalBindingSource } from '../types/workflow.types.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION } from '../types/workflow.types.js';
import {
  nodiaAiLocalOperationIdentity,
  validateNodiaAiLocalReceipt,
} from '../types/local-operation.types.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from './validate-nodia-ai-proposal.use-case.js';
import { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';

interface RemainingInput {
  execution_id: string;
  expected_execution_revision: number;
  edits: ProposalFieldEdit[];
}

/** Explicit material correction creates a new proposal; receipts and completed sources remain immutable. */
@Injectable()
export class PrepareNodiaAiRemainingWorkflowUseCase {
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    private readonly prepare: PrepareNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async execute(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    raw: unknown,
  ): Promise<NodiaAiJsonObject> {
    if (!manager.queryRunner?.isTransactionActive)
      throw new BadRequestException('authorization:transaction_required');
    this.validate.assert('RemainingWorkflowPrepareInput', raw);
    const input = raw as RemainingInput;
    await lockAuthority(
      manager,
      false,
      this.policy.timing.read_query_seconds * 1000,
    );
    await lockNodiaAiQueue(manager);
    const initial = await manager
      .getRepository(NodiaAiExecution)
      .findOneBy({ id: input.execution_id });
    if (!initial?.proposal_id)
      throw new NotFoundException('nodia_ai:operation_not_found');
    const loaded = await this.get.load(
      manager,
      identity,
      initial.proposal_id,
      'write',
      initial.origin_proposal_revision,
    );
    const jobs = await manager.getRepository(NodiaAiJob).find({
      where: { execution_id: initial.id },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    const execution = await manager.getRepository(NodiaAiExecution).findOne({
      where: { id: initial.id },
      lock: { mode: 'pessimistic_write' },
    });
    const statuses = await manager.getRepository(NodiaAiExecutionStep).find({
      where: { execution_id: initial.id },
      order: { position: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !execution ||
      execution.actor_id !== loaded.context.actor.actorId ||
      execution.conversation_id !== loaded.chat.id ||
      execution.origin_conversation_id !== loaded.chat.id ||
      execution.origin_proposal_id !== loaded.proposal.id ||
      execution.proposal_id !== loaded.proposal.id ||
      execution.origin_proposal_revision !== loaded.revision.revision ||
      execution.proposal_hash !== loaded.revision.hash ||
      execution.catalog_version !== loaded.revision.catalog_version ||
      execution.chat_owner_id !== loaded.chat.owner_id
    )
      throw new NotFoundException('nodia_ai:operation_not_found');
    if (
      execution.revision !== input.expected_execution_revision ||
      execution.revision >= 2147483647
    )
      throw new ConflictException('nodia_ai:revision_conflict');
    const next = nextNodiaAiExecutionStep(statuses);
    const failed = statuses[next];
    if (
      !['failed', 'partially_completed'].includes(execution.state) ||
      execution.completed_at !== null ||
      loaded.chat.active_job_id ||
      execution.retention_epoch !== loaded.chat.retention_epoch ||
      next < 0 ||
      !failed ||
      statuses.length !== loaded.steps.length ||
      statuses.length > this.policy.budget.steps_per_proposal ||
      failed.state !== 'failed' ||
      failed.minimal_receipt !== null ||
      failed.dispatched_at !== null ||
      failed.completed_at !== null ||
      failed.recovery_descriptor?.schema_version !== 1 ||
      failed.recovery_descriptor.kind !== 'local_transaction_rolled_back' ||
      statuses
        .slice(next + 1)
        .some(
          (step) =>
            !['ready', 'pending', 'blocked'].includes(step.state) ||
            step.minimal_receipt !== null ||
            step.dispatched_at !== null ||
            step.completed_at !== null,
        )
    )
      throw new ConflictException('nodia_ai:execution_not_resumable');
    const job = jobs[0];
    if (
      jobs.length !== 1 ||
      job.kind !== 'execution' ||
      job.execution_id !== execution.id ||
      job.conversation_id !== loaded.chat.id ||
      job.run_id !== null ||
      job.stage_key !== 'execution_step' ||
      !['failed', 'unknown'].includes(job.state) ||
      job.lease_owner !== null ||
      job.lease_until !== null
    )
      throw new ConflictException('nodia_ai:execution_conflict');
    const activeAttempts: { id: string }[] = await manager.query(
      'SELECT id FROM nodia_ai_job_attempts WHERE job_id=$1 AND ended_at IS NULL LIMIT 1',
      [job.id],
    );
    if (activeAttempts.length)
      throw new ConflictException('nodia_ai:execution_conflict');
    const expectedScope = {
      schema_version: 1,
      steps: loaded.steps.map((source) => ({
        step_id: source.id,
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
      })),
    };
    if (!this.validate.equal(expectedScope, execution.minimal_scope))
      return this.invalid();
    const resolved = loaded.steps.map((source, index) => {
      const status = statuses[index];
      if (
        source.id !== status.id ||
        status.source_step_id !== source.id ||
        status.execution_id !== execution.id ||
        source.position !== status.position ||
        source.tool_name !== status.tool_name ||
        !nodiaAiLocalOperationIdentity(source.tool_name) ||
        !this.validate.equal(source.scope, status.minimal_scope) ||
        status.template_hash !==
          this.validate.hash({
            command_template: source.command_template,
            output_bindings: source.output_bindings,
            preconditions: source.preconditions,
          })
      )
        return this.invalid();
      const bound = boundNodiaAiProposalStep(source, status);
      if (
        status.bound_command_hash !== null &&
        status.bound_command_hash !==
          this.validate.hash(
            nodiaAiBoundExecutionBinding(bound, status.bound_command != null),
          )
      )
        return this.invalid();
      if (index < next) {
        if (
          !status.completed_at ||
          !status.dispatched_at ||
          !status.bound_command_hash ||
          status.error_code !== null
        )
          return this.invalid();
        validateNodiaAiLocalReceipt(
          bound,
          status.minimal_receipt,
          this.validate.assert.bind(this.validate),
        );
      }
      return bound;
    });
    const pendingSources = loaded.steps.slice(next);
    const pendingIds = new Set(pendingSources.map((step) => step.id));
    const edited = new Set<string>();
    for (const edit of input.edits) {
      const source = pendingSources.find((step) => step.id === edit.step_id);
      const key = `${edit.step_id}:${edit.field_key}`;
      if (
        !source ||
        edited.has(key) ||
        !Object.hasOwn(
          this.validate.preparer(source.tool_name).editableFields,
          edit.field_key,
        ) ||
        source.output_bindings.some(
          (binding) => binding.target_field_key === edit.field_key,
        )
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      edited.add(key);
    }
    const proposal = Object.assign(new NodiaAiProposal(), {
      id: randomUUID(),
      conversation_id: loaded.chat.id,
      actor_id: loaded.context.actor.actorId,
      prior_execution_id: execution.id,
      current_revision: 1,
      created_at: loaded.now,
    });
    const ids = new Map(pendingSources.map((step) => [step.id, randomUUID()]));
    const steps: NodiaAiProposalStep[] = [];
    for (const [offset, source] of pendingSources.entries()) {
      const port = this.validate.preparer(
        source.tool_name,
        source.contract_hash,
      );
      let base: PreparedProposalStep = {
        commandTemplate: resolved[next + offset].command_template,
        scope: resolved[next + offset].scope,
        preconditions: resolved[next + offset].preconditions,
        publicStep: source.public_step,
      };
      const future: NodiaAiProposalBindingSource[] = [];
      const completedValues: Record<
        string,
        { value: string; source: StoredProposalStep }
      > = {};
      for (const binding of source.output_bindings) {
        const sourceIndex = loaded.steps.findIndex(
          (step) => step.id === binding.from_step_id,
        );
        const ancestor = loaded.steps[sourceIndex];
        const target = String(binding.target_field_key);
        if (
          !ancestor ||
          sourceIndex >= next + offset ||
          binding.output_key !== 'id' ||
          !Object.hasOwn(port.bindableFields, target) ||
          port.bindableFields[target] !==
            this.validate.preparer(ancestor.tool_name, ancestor.contract_hash)
              .outputKeys.id
        )
          return this.invalid();
        if (pendingIds.has(ancestor.id)) {
          const preparedAncestor = steps.find(
            (step) => step.id === ids.get(ancestor.id),
          );
          if (!preparedAncestor) return this.invalid();
          future.push({
            target_field_key: target,
            output_key: 'id',
            from_step_id: preparedAncestor.id,
            source: storedStep(preparedAncestor),
          });
        } else {
          const receipt = validateNodiaAiLocalReceipt(
            resolved[sourceIndex],
            statuses[sourceIndex].minimal_receipt,
            this.validate.assert.bind(this.validate),
          );
          completedValues[target] = {
            value: receipt.id,
            source: storedStep(resolved[sourceIndex]),
          };
        }
      }
      if (
        Object.keys(completedValues).length &&
        statuses[next + offset].bound_command == null
      ) {
        // This is a new proposal, rather than a retry of the old approval. Only
        // the registered provider relation may become a literal, derived from
        // its verified receipt. Reprepare below reads current domain state and
        // exposes it to the next human confirmation; strict execution binding
        // must continue rejecting changes against the original frozen parent.
        const parent = completedValues.provider_id;
        if (
          source.tool_name !== 'nodia_provider_contacts_prepare_create' ||
          source.output_bindings.length !== 1 ||
          Object.keys(completedValues).length !== 1 ||
          !parent ||
          parent.source.toolName !== 'nodia_providers_prepare_create' ||
          parent.source.scope.business_id !== source.scope.business_id ||
          Object.hasOwn(source.command_template, 'provider_id') ||
          Object.hasOwn(source.scope, 'provider_id')
        )
          return this.invalid();
        base = {
          ...base,
          commandTemplate: {
            ...source.command_template,
            provider_id: parent.value,
          },
          scope: { ...source.scope, provider_id: parent.value },
        };
      }
      const edits = input.edits.filter((edit) => edit.step_id === source.id);
      const template = edits.length
        ? await port.applyEdits(base.commandTemplate, edits, loaded.context)
        : base.commandTemplate;
      if (future.length && !port.reprepareWithBindings)
        throw new BadRequestException('nodia_ai:catalog_changed');
      const prepared = await (future.length
        ? port.reprepareWithBindings!(template, future, loaded.context)
        : port.reprepareStored
          ? port.reprepareStored(template, loaded.context)
          : port.prepare(template, loaded.context));
      if (prepared.status !== 'ready')
        throw new BadRequestException('nodia_ai:proposal_needs_clarification');
      if (!this.validate.equal(prepared.scope, base.scope))
        throw new BadRequestException('nodia_ai:invalid_input');
      const bindings = future.map(({ source: _source, ...binding }) => binding);
      const step = this.prepare.step(
        proposal.id,
        1,
        offset + 1,
        port.toolName,
        port.contractHash,
        {
          ...prepared,
          publicStep: {
            ...prepared.publicStep,
            depends_on: [
              ...new Set(bindings.map((binding) => binding.from_step_id)),
            ],
            output_bindings: bindings,
          },
        },
        ids.get(source.id),
      );
      await port.verifyAuthority(storedStep(step), loaded.context);
      steps.push(step);
    }
    const revision = Object.assign(new NodiaAiProposalRevision(), {
      proposal_id: proposal.id,
      revision: 1,
      state: 'ready',
      hash: '',
      catalog_version: NODIA_AI_WORKFLOW_CATALOG_VERSION,
      canonicalization_version: 'jcs-rfc8785/1',
      created_at: loaded.now,
      expires_at: new Date(
        Math.min(
          loaded.chat.expires_at.getTime(),
          loaded.now.getTime() + this.policy.timing.proposal_seconds * 1000,
        ),
      ),
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
    await this.store.create(manager, proposal, revision, steps);
    await manager.query(
      "UPDATE nodia_ai_jobs SET state='cancelled',lease_owner=NULL,lease_until=NULL,fence=fence+1,updated_at=$2 WHERE id=$1",
      [job.id, loaded.now],
    );
    await manager.query(
      "UPDATE nodia_ai_execution_steps SET state='cancelled',error_code=NULL,recovery_descriptor=NULL,lease_fence=$2 WHERE execution_id=$1 AND state<>'completed'",
      [execution.id, (BigInt(job.fence) + 1n).toString()],
    );
    await manager.query(
      'UPDATE nodia_ai_execution_grants SET revoked_at=COALESCE(revoked_at,$2) WHERE execution_id=$1',
      [execution.id, loaded.now],
    );
    await manager.query(
      'UPDATE nodia_ai_executions SET state=$2,revision=revision+1,completed_at=$3 WHERE id=$1',
      [
        execution.id,
        next > 0 ? 'partially_completed' : 'cancelled',
        loaded.now,
      ],
    );
    const routes = [
      ...new Set(
        loaded.steps.flatMap(
          (source) => this.validate.preparer(source.tool_name).moduleRoutes,
        ),
      ),
    ];
    await appendNodiaAiExecutionEvent(manager, {
      conversationId: loaded.chat.id,
      executionId: execution.id,
      eventKey: `execution:${execution.id}:${execution.revision + 1}:corrected`,
      payload: {
        revision: execution.revision + 1,
        state: next > 0 ? 'partially_completed' : 'cancelled',
        error: null,
      },
      moduleRoutes: routes,
      maxEvents: this.policy.results.outbox_events_per_activity,
    });
    return result;
  }
  private invalid(): never {
    throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
  }
}
