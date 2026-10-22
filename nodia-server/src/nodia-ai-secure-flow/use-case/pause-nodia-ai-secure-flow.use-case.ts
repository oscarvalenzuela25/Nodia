import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { NodiaAiExecutionService } from '../../nodia-ai-execution/nodia-ai-execution.service.js';
import type { NodiaAiExecutionClaim } from '../../nodia-ai-execution/types/execution-claim.types.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import { ValidateNodiaAiConfirmationUseCase } from '../../nodia-ai-confirmation/use-case/validate-nodia-ai-confirmation.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiExecution } from '../../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import { nodiaAiBoundExecutionBinding } from '../../nodia-ai-execution/types/bound-execution-step.js';
import type { SecureFlowDescriptor } from '../types/secure-flow.types.js';

/** A worker only establishes the human pause. It never acquires a provider profile or calls login. */
@Injectable()
export class PauseNodiaAiSecureFlowUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    private readonly status: GetNodiaAiExecutionUseCase,
    private readonly validate: ValidateNodiaAiConfirmationUseCase,
    private readonly proposals: ValidateNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async execute(claim: NodiaAiExecutionClaim): Promise<boolean> {
    if (claim.toolName && !nodiaAiSecureOperationIdentity(claim.toolName))
      return false;
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      const initial = await this.store.execution(manager, claim.executionId);
      if (!initial) throw new ConflictException('nodia_ai:execution_conflict');
      const loaded = await this.status.authorize(
        manager,
        claim.identity,
        claim.executionId,
        'write',
      );
      const sources = loaded.steps;
      if (
        !sources.some((source) =>
          nodiaAiSecureOperationIdentity(source.tool_name),
        )
      )
        return false;
      if (sources.length !== 1)
        throw new ConflictException('nodia_ai:execution_unsupported');
      const source = sources[0],
        operation = nodiaAiSecureOperationIdentity(source.tool_name);
      if (!operation)
        throw new ConflictException('nodia_ai:execution_unsupported');
      const jobs = await this.store.jobs(manager, claim.executionId);
      const execution = await this.store.execution(
        manager,
        claim.executionId,
        true,
      );
      const steps = await this.store.steps(manager, claim.executionId);
      const grants = await this.store.grants(manager, claim.executionId);
      const job = jobs[0],
        step = steps[0],
        grant = grants[0],
        now = await this.store.now(manager);
      if (
        !execution ||
        steps.length !== 1 ||
        jobs.length !== 1 ||
        grants.length !== 1 ||
        !step ||
        !job ||
        !grant ||
        execution.state !== 'running' ||
        step.state !== 'running' ||
        job.state !== 'leased' ||
        job.id !== claim.jobId ||
        job.lease_owner !== claim.workerId ||
        job.fence !== claim.fence ||
        step.lease_fence !== claim.fence ||
        !job.lease_until ||
        job.lease_until <= now ||
        job.deadline_at <= now ||
        grant.revoked_at ||
        grant.expires_at <= now ||
        grant.actor_id !== loaded.actor.actorId ||
        grant.session_public_id !== loaded.actor.sessionId ||
        loaded.actor.actorId !== execution.actor_id ||
        execution.actor_id !== loaded.chat.owner_id ||
        grant.command_set_hash !== execution.proposal_hash ||
        loaded.chat.active_job_id !== job.id ||
        grant.policy_version !== this.policy.policyVersion ||
        grant.run_id !== null ||
        grant.execution_id !== execution.id ||
        !this.proposals.equal(grant.allowed_operations, [source.tool_name]) ||
        !this.proposals.equal(
          grant.allowed_modules,
          [
            ...this.proposals.preparer(source.tool_name, source.contract_hash)
              .moduleRoutes,
          ].sort(),
        ) ||
        !this.proposals.equal(grant.allowed_scope, execution.minimal_scope) ||
        execution.retention_epoch !== loaded.chat.retention_epoch ||
        step.recovery_descriptor !== null ||
        step.minimal_receipt !== null ||
        step.dispatched_at !== null ||
        step.completed_at !== null ||
        execution.revision >= 2147483647
      )
        throw new ConflictException('nodia_ai:execution_conflict');
      const resume = job.recovery_descriptor;
      const resumed =
        resume?.schema_version === 1 &&
        resume.kind === 'human_execution_resume' &&
        resume.actor_id === loaded.actor.actorId &&
        resume.session_public_id === loaded.actor.sessionId &&
        resume.proposal_hash === execution.proposal_hash &&
        typeof resume.execution_revision === 'number' &&
        execution.revision >= resume.execution_revision + 1 &&
        resume.expected_execution_revision === resume.execution_revision - 1;
      if (
        (resume !== null && !resumed) ||
        !(await this.store.confirmedBySession(
          manager,
          execution,
          resumed ? null : loaded.actor.sessionId,
        ))
      )
        throw new ForbiddenException('nodia_ai:confirmation_invalid');
      await this.status.project(manager, execution, now, sources);
      await this.proposals
        .preparer(source.tool_name, source.contract_hash)
        .verifyPreconditions(storedStep(source), loaded.context);
      const sessionExpiry = await this.store.sessionExpiry(
        manager,
        loaded.actor.actorId,
        loaded.actor.sessionId,
      );
      if (!sessionExpiry || sessionExpiry <= now)
        throw new ForbiddenException('auth:session_expired');
      const expires = new Date(
        Math.min(
          now.getTime() + this.policy.timing.secure_human_seconds * 1000,
          job.deadline_at.getTime(),
          grant.expires_at.getTime(),
          loaded.chat.expires_at.getTime(),
          sessionExpiry.getTime(),
        ),
      );
      const descriptor: SecureFlowDescriptor = {
        schema_version: 1,
        kind: 'secure_human_flow',
        reference: randomUUID(),
        flow_kind: operation.kind,
        actor_id: loaded.actor.actorId,
        session_id: loaded.actor.sessionId,
        expires_at: expires.toISOString(),
        status: 'waiting',
        native_reference: null,
        request_id: null,
        request_action: null,
        request_revision: null,
        native_request: null,
      };
      step.bound_command_hash = this.validate.hash(
        nodiaAiBoundExecutionBinding(source, false),
      );
      step.recovery_descriptor = descriptor;
      step.state = 'waiting_for_user';
      execution.state = 'waiting_for_user';
      execution.revision++;
      job.state = 'waiting';
      job.lease_owner = null;
      job.lease_until = null;
      job.updated_at = now;
      await manager.getRepository(NodiaAiExecutionStep).save(step);
      await manager.getRepository(NodiaAiExecution).save(execution);
      await manager.getRepository(NodiaAiJob).save(job);
      const changed = await manager.getRepository(NodiaAiJobAttempt).update(
        {
          id: claim.attemptId,
          job_id: claim.jobId,
          worker_id: claim.workerId,
          fence: claim.fence,
          phase: 'claimed',
        },
        { phase: 'completed', ended_at: now },
      );
      if (changed.affected !== 1)
        throw new ConflictException('nodia_ai:execution_conflict');
      await appendNodiaAiExecutionEvent(manager, {
        conversationId: loaded.chat.id,
        executionId: execution.id,
        eventKey: `execution:${execution.id}:${execution.revision}:waiting_for_user`,
        payload: {
          revision: execution.revision,
          state: 'waiting_for_user',
          error: null,
        },
        moduleRoutes: grant.allowed_modules,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      return true;
    });
  }
}
