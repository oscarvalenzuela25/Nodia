import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiExecution } from '../entities/nodia-ai-execution.entity.js';
import type { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiExecutionStep } from '../entities/nodia-ai-execution-step.entity.js';
import { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { ValidateNodiaAiConfirmationUseCase } from './validate-nodia-ai-confirmation.use-case.js';
import {
  nodiaAiLocalOperationIdentity,
  validateNodiaAiLocalReceipt,
} from '../../nodia-ai-proposal/types/local-operation.types.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import {
  secureDescriptor,
  secureUuid,
} from '../../nodia-ai-secure-flow/types/secure-flow.types.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import {
  boundNodiaAiProposalStep,
  nodiaAiBoundExecutionBinding,
} from '../../nodia-ai-execution/types/bound-execution-step.js';
import {
  nextNodiaAiExecutionStep,
  nodiaAiExecutionResumeEventSlots,
} from '../../nodia-ai-execution/types/sequential-execution.js';
@Injectable()
export class GetNodiaAiExecutionUseCase {
  constructor(
    private readonly store: NodiaAiConfirmationService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiConfirmationUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly availability: NodiaAiConfirmationAvailabilityUseCase,
  ) {}
  execute(identity: NodiaAiActorReference, id: string) {
    const key = conversationId(id);
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      return this.load(manager, identity, key);
    });
  }
  async load(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
    knownChat?: string,
  ) {
    const loaded = await this.authorize(
      manager,
      identity,
      id,
      'read',
      knownChat,
    );
    return this.project(
      manager,
      loaded.execution,
      loaded.now,
      loaded.steps,
      loaded.actor.actorId === loaded.execution.actor_id,
    );
  }
  async authorize(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    id: string,
    mode: 'read' | 'write',
    knownChat?: string,
  ) {
    const initial = await this.store.execution(manager, conversationId(id));
    if (
      !initial?.proposal_id ||
      !initial.conversation_id ||
      (knownChat && initial.conversation_id !== knownChat)
    )
      throw new NotFoundException('nodia_ai:operation_not_found');
    const loaded = await this.get.load(
      manager,
      identity,
      initial.proposal_id,
      mode,
      initial.origin_proposal_revision,
    );
    // A worker can finish while this reader waits for the chat lock. Project the
    // header and steps from the same protected state, rather than the first read.
    const execution = await this.store.execution(manager, conversationId(id));
    if (
      !execution ||
      loaded.proposal.conversation_id !== execution.conversation_id ||
      execution.origin_conversation_id !== loaded.chat.id ||
      execution.origin_proposal_id !== loaded.proposal.id ||
      execution.origin_proposal_revision !== loaded.revision.revision ||
      execution.actor_id !== loaded.proposal.actor_id ||
      execution.chat_owner_id !== loaded.chat.owner_id ||
      execution.catalog_version !== loaded.revision.catalog_version ||
      execution.proposal_hash !== loaded.revision.hash
    )
      throw new NotFoundException('nodia_ai:operation_not_found');
    return { ...loaded, execution };
  }
  async project(
    manager: EntityManager,
    execution: NodiaAiExecution,
    now: Date,
    sourceSteps: readonly NodiaAiProposalStep[],
    resumeAllowed = true,
  ) {
    const steps = await this.store.steps(manager, execution.id);
    const expectedScope = {
      schema_version: 1,
      steps: sourceSteps.map((source) => ({
        step_id: source.id,
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
      })),
    };
    if (
      !sourceSteps.length ||
      sourceSteps.length > this.policy.budget.steps_per_proposal ||
      nextNodiaAiExecutionStep(steps) < 0 ||
      this.validate.hash(expectedScope) !==
        this.validate.hash(execution.minimal_scope) ||
      steps.length !== sourceSteps.length ||
      steps.some((step, index) => {
        const source = sourceSteps[index];
        return (
          step.id !== source.id ||
          step.execution_id !== execution.id ||
          step.source_step_id !== source.id ||
          step.position !== source.position ||
          step.tool_name !== source.tool_name ||
          this.validate.hash(step.minimal_scope) !==
            this.validate.hash(source.scope) ||
          step.template_hash !==
            this.validate.hash({
              command_template: source.command_template,
              output_bindings: source.output_bindings,
              preconditions: source.preconditions,
            })
        );
      })
    )
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    const invalid = (): never => {
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    };
    const next = nextNodiaAiExecutionStep(steps);
    if (
      steps
        .slice(next + 1)
        .some(
          (step) =>
            !['ready', 'blocked', 'pending', 'skipped', 'cancelled'].includes(
              step.state,
            ) ||
            step.minimal_receipt !== null ||
            step.dispatched_at !== null ||
            step.completed_at !== null,
        )
    )
      invalid();
    const completedReferences = new Map<
      string,
      { resource_key: string; id: string }
    >();
    const references = steps.map((step, index) => {
      const source = boundNodiaAiProposalStep(sourceSteps[index], step);
      if (step.bound_command != null) {
        for (const binding of source.output_bindings) {
          if (
            binding.target_field_key !== 'provider_id' ||
            binding.output_key !== 'id' ||
            typeof binding.from_step_id !== 'string'
          )
            return invalid();
          const prior = completedReferences.get(binding.from_step_id);
          if (
            !prior ||
            prior.resource_key !== 'providers' ||
            source.command_template.provider_id !== prior.id
          )
            return invalid();
        }
      }
      const expectedBoundHash =
        step.bound_command_hash === null
          ? null
          : this.validate.hash(
              nodiaAiBoundExecutionBinding(source, step.bound_command != null),
            );
      if (step.bound_command_hash !== expectedBoundHash) invalid();
      if (step.state !== 'completed') {
        if (step.minimal_receipt !== null) invalid();
        if (
          step.state === 'skipped' &&
          (step.dispatched_at !== null || step.completed_at !== null)
        )
          invalid();
        return [];
      }
      const secure = nodiaAiSecureOperationIdentity(source.tool_name);
      if (
        (!nodiaAiLocalOperationIdentity(source.tool_name) && !secure) ||
        !step.completed_at ||
        !step.dispatched_at ||
        !step.bound_command_hash ||
        (sourceSteps.length > 1 && step.bound_command == null) ||
        step.error_code !== null
      )
        return invalid();
      if (secure) {
        const descriptor = secureDescriptor(step.recovery_descriptor);
        this.validate.assert('SecureFlowReceipt', step.minimal_receipt, true);
        if (
          !step.minimal_receipt ||
          step.minimal_receipt.operation !== secure.kind ||
          step.minimal_receipt.id !== descriptor.reference ||
          descriptor.flow_kind !== secure.kind ||
          descriptor.actor_id !== execution.actor_id ||
          descriptor.status !== 'completed' ||
          typeof step.minimal_receipt.id !== 'string' ||
          !secureUuid.test(step.minimal_receipt.id)
        )
          return invalid();
        return [{ resource_key: 'secure_flows', id: descriptor.reference }];
      }
      const reference = validateNodiaAiLocalReceipt(
        source,
        step.minimal_receipt,
        (schema, value, persisted) =>
          this.validate.assert(schema, value, persisted),
      );
      completedReferences.set(source.id, reference);
      return [reference];
    });
    if (
      execution.state === 'completed' &&
      (!execution.completed_at ||
        steps.some(
          (step) =>
            step.state !== 'completed' ||
            !step.completed_at ||
            step.completed_at > execution.completed_at!,
        ))
    )
      invalid();
    const resumable =
      resumeAllowed &&
      canResumeLocalExecution(execution, steps, sourceSteps) &&
      this.availability.describe(sourceSteps, execution.catalog_version)
        .can_confirm;
    const hasEventBudget =
      resumable &&
      (await this.store.executionEventCount(
        manager,
        execution.id,
        this.policy.results.outbox_events_per_activity,
      )) <=
        this.policy.results.outbox_events_per_activity -
          nodiaAiExecutionResumeEventSlots(steps);
    const result = {
      execution_id: execution.id,
      revision: execution.revision,
      state: execution.state,
      steps: steps.map((step, index) => ({
        step_id: step.id,
        state: step.state,
        result_refs: references[index],
        error: step.error_code
          ? {
              code: step.error_code,
              message_key: step.error_code,
              field_errors: [],
              retry_action: 'none',
              correlation_id: step.id,
            }
          : null,
      })),
      can_resume: hasEventBudget,
      observed_at: now.toISOString(),
    };
    this.validate.assert('ExecutionStatus', result, true);
    return result;
  }
}
/** A failed local transaction is retryable only after the worker proved rollback under the common locks. */
export function canResumeLocalExecution(
  execution: NodiaAiExecution,
  steps: readonly NodiaAiExecutionStep[],
  sources: readonly NodiaAiProposalStep[],
): boolean {
  const next = nextNodiaAiExecutionStep(steps);
  const step = steps[next];
  const source = sources[next];
  return (
    !!step &&
    !!source &&
    ['failed', 'partially_completed'].includes(execution.state) &&
    execution.completed_at === null &&
    steps.length > 0 &&
    steps.length === sources.length &&
    (nodiaAiLocalOperationIdentity(source.tool_name) !== null ||
      nodiaAiSecureOperationIdentity(source.tool_name) !== null) &&
    step.state === 'failed' &&
    step.minimal_receipt === null &&
    step.dispatched_at === null &&
    step.completed_at === null &&
    step.recovery_descriptor?.schema_version === 1 &&
    step.recovery_descriptor.kind === 'local_transaction_rolled_back' &&
    step.error_code !== 'nodia_ai:preconditions_changed' &&
    steps
      .slice(next + 1)
      .every(
        (pending) =>
          ['ready', 'blocked', 'pending'].includes(pending.state) &&
          pending.minimal_receipt === null &&
          pending.dispatched_at === null &&
          pending.completed_at === null,
      )
  );
}
