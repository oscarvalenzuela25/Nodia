import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { QueryFailedError } from 'typeorm';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import { boundNodiaAiProposalStep } from '../../nodia-ai-execution/types/bound-execution-step.js';
import {
  nextNodiaAiExecutionStep,
  nodiaAiExecutionResumeEventSlots,
} from '../../nodia-ai-execution/types/sequential-execution.js';
import { nodiaAiLocalOperationIdentity } from '../../nodia-ai-proposal/types/local-operation.types.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import {
  storedStep,
  ValidateNodiaAiProposalUseCase,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import {
  canResumeLocalExecution,
  GetNodiaAiExecutionUseCase,
} from './get-nodia-ai-execution.use-case.js';
import { NodiaAiConfirmationAvailabilityUseCase } from './nodia-ai-confirmation-availability.use-case.js';
import { ValidateNodiaAiConfirmationUseCase } from './validate-nodia-ai-confirmation.use-case.js';

/** Human channel only. No inference, network call, or second business effect runs here. */
@Injectable()
export class ControlNodiaAiExecutionUseCase {
  constructor(
    private readonly store: NodiaAiConfirmationService,
    private readonly status: GetNodiaAiExecutionUseCase,
    private readonly validate: ValidateNodiaAiConfirmationUseCase,
    private readonly proposalValidator: ValidateNodiaAiProposalUseCase,
    private readonly availability: NodiaAiConfirmationAvailabilityUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    id: string,
    input: unknown,
    operation: 'cancel' | 'resume',
  ) {
    const key = conversationId(id);
    const request = this.validate.control(input, operation);
    const outcome = await this.store
      .transaction(async (manager) => {
        await lockAuthority(
          manager,
          false,
          this.policy.timing.read_query_seconds * 1000,
        );
        await lockNodiaAiQueue(manager);
        const loaded = await this.status.authorize(
          manager,
          identity,
          key,
          'write',
        );
        const jobs = await this.store.lockJobs(manager, key);
        const execution = await this.store.lockExecution(manager, key);
        const steps = await this.store.lockSteps(manager, key);
        if (
          !execution ||
          execution.actor_id !== loaded.actor.actorId ||
          execution.conversation_id !== loaded.chat.id ||
          execution.proposal_hash !== loaded.revision.hash ||
          execution.origin_proposal_revision !== loaded.revision.revision
        )
          throw new NotFoundException('nodia_ai:operation_not_found');
        // Validate immutable witness before making any state transition, including terminal replay.
        const current = await this.status.project(
          manager,
          execution,
          loaded.now,
          loaded.steps,
        );
        const terminal = steps.every((step) =>
          ['completed', 'cancelled', 'skipped'].includes(step.state),
        );
        if (operation === 'cancel' && terminal) {
          const result = { status: 'already_terminal', execution: current };
          this.validate.assert('ExecutionCancellationResult', result, true);
          return result;
        }
        if (jobs.length !== 1)
          throw new ConflictException('nodia_ai:execution_conflict');
        const job = jobs[0];
        if (job.recovery_descriptor?.restore_quarantined !== undefined)
          throw new ConflictException('nodia_ai:restore_reconciliation_required');
        const resume = job.recovery_descriptor;
        if (
          operation === 'resume' &&
          resume?.kind === 'human_execution_resume' &&
          resume.client_request_id === request.client_request_id
        ) {
          if (
            resume.actor_id !== loaded.actor.actorId ||
            resume.expected_execution_revision !==
              request.expected_execution_revision ||
            resume.proposal_hash !== execution.proposal_hash
          )
            throw new ConflictException('nodia_ai:request_conflict');
          const result = { execution: current };
          this.validate.assert('ExecutionAccepted', result, true);
          return result;
        }
        if (execution.revision !== request.expected_execution_revision)
          throw new ConflictException('nodia_ai:revision_conflict');
        const next = nextNodiaAiExecutionStep(steps);
        const pending = steps[next];
        if (
          execution.revision >= 2147483647 ||
          !steps.length ||
          steps.length > this.policy.budget.steps_per_proposal ||
          steps.length !== loaded.steps.length ||
          !pending ||
          loaded.steps.some(
            (step) =>
              !nodiaAiLocalOperationIdentity(step.tool_name) &&
              !nodiaAiSecureOperationIdentity(step.tool_name),
          ) ||
          pending.minimal_receipt !== null ||
          pending.completed_at !== null ||
          pending.dispatched_at !== null
        )
          throw new ConflictException('nodia_ai:execution_conflict');
        if (
          nodiaAiSecureOperationIdentity(pending.tool_name) &&
          pending.recovery_descriptor?.kind === 'secure_human_flow'
        )
          throw new ConflictException('nodia_ai:secure_flow_required');
        if (
          job.kind !== 'execution' ||
          job.conversation_id !== loaded.chat.id ||
          job.execution_id !== execution.id ||
          job.stage_key !== 'execution_step' ||
          job.run_id !== null ||
          execution.retention_epoch !== loaded.chat.retention_epoch
        )
          throw new ConflictException('nodia_ai:execution_conflict');
        const modules = [
          ...new Set(
            loaded.steps.flatMap(
              (step) =>
                this.proposalValidator.preparer(
                  step.tool_name,
                  step.contract_hash,
                ).moduleRoutes,
            ),
          ),
        ].sort();
        const now = await this.store.now(manager);
        let nextState: 'queued' | 'cancelled' | 'partially_completed';
        if (operation === 'resume') {
          if (
            !canResumeLocalExecution(execution, steps, loaded.steps) ||
            !['failed', 'unknown'].includes(job.state) ||
            loaded.chat.active_job_id
          )
            throw new ConflictException('nodia_ai:execution_not_resumable');
          this.availability.require(
            loaded.steps,
            loaded.revision.catalog_version,
          );
          // Reserve both events for every remaining effect and four terminal slots.
          if (
            (await this.store.executionEventCount(
              manager,
              key,
              this.policy.results.outbox_events_per_activity,
            )) >
            this.policy.results.outbox_events_per_activity -
              nodiaAiExecutionResumeEventSlots(steps)
          )
            throw new ConflictException('nodia_ai:execution_limit');
          try {
            for (let index = next; index < loaded.steps.length; index++) {
              const source = loaded.steps[index];
              const resolved = boundNodiaAiProposalStep(source, steps[index]);
              const preparer = this.proposalValidator.preparer(
                source.tool_name,
                source.contract_hash,
              );
              if (
                source.output_bindings.length &&
                steps[index].bound_command == null
              )
                await preparer.verifyAuthority(
                  storedStep(source),
                  loaded.context,
                );
              else
                await preparer.verifyPreconditions(
                  storedStep(resolved),
                  loaded.context,
                );
            }
          } catch (error) {
            if (
              !(error instanceof ConflictException) ||
              error.message !== 'nodia_ai:preconditions_changed'
            )
              throw error;
            // Persist the material-change outcome before returning 409; it requires a new proposal/button.
            await manager.query(
              "UPDATE nodia_ai_execution_steps SET error_code='nodia_ai:preconditions_changed' WHERE execution_id=$1 AND id=$2",
              [key, pending.id],
            );
            await manager.query(
              'UPDATE nodia_ai_executions SET revision=revision+1 WHERE id=$1',
              [key],
            );
            await appendNodiaAiExecutionEvent(manager, {
              conversationId: loaded.chat.id,
              executionId: key,
              eventKey: `execution:${key}:${execution.revision + 1}:failed`,
              payload: {
                revision: execution.revision + 1,
                state: execution.state,
                error: null,
              },
              moduleRoutes: modules,
              maxEvents: this.policy.results.outbox_events_per_activity,
            });
            return error;
          }
          const sessionExpiry = await this.store.sessionExpiry(
            manager,
            loaded.actor.actorId,
            loaded.actor.sessionId,
          );
          if (!sessionExpiry)
            throw new UnauthorizedException('auth:session_expired');
          const admitted = await this.store.now(manager);
          if (admitted >= sessionExpiry || admitted >= loaded.chat.expires_at)
            throw new UnauthorizedException('auth:session_expired');
          const [counts]: { global_waiting: string; owner_waiting: string }[] =
            await manager.query(
              `SELECT count(*) FILTER(WHERE j.state IN ('ready','waiting'))::text AS global_waiting,
           count(*) FILTER(WHERE j.state IN ('ready','waiting') AND c.owner_id=$1)::text AS owner_waiting
           FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id
           WHERE j.kind IN ('turn','execution') AND c.lifecycle='active' AND c.expires_at>$2`,
              [loaded.actor.actorId, admitted],
            );
          if (
            Number(counts.global_waiting) >= this.policy.queue.waiting_global ||
            Number(counts.owner_waiting) >= this.policy.queue.waiting_per_owner
          )
            throw new HttpException(
              {
                message: 'nodia_ai:execution_limit',
                retry_after_seconds:
                  this.policy.queue.local_retry_after_seconds,
              },
              HttpStatus.TOO_MANY_REQUESTS,
            );
          const deadline = new Date(
            Math.min(
              admitted.getTime() +
                this.policy.timing.execution_admission_seconds * 1000,
              sessionExpiry.getTime(),
              loaded.chat.expires_at.getTime(),
            ),
          );
          const grants: { id: string }[] = await manager.query(
            `WITH renewed AS (UPDATE nodia_ai_execution_grants SET session_public_id=$2,expires_at=$3,revoked_at=NULL,policy_version=$4
           WHERE execution_id=$1 AND actor_id=$5 AND command_set_hash=$6 AND run_id IS NULL
           AND allowed_scope=$7::jsonb AND allowed_modules=$8::jsonb AND allowed_operations=$9::jsonb RETURNING id) SELECT id FROM renewed`,
            [
              key,
              loaded.actor.sessionId,
              deadline,
              this.policy.policyVersion,
              loaded.actor.actorId,
              execution.proposal_hash,
              JSON.stringify(execution.minimal_scope),
              JSON.stringify(modules),
              JSON.stringify(
                [...new Set(loaded.steps.map((step) => step.tool_name))].sort(),
              ),
            ],
          );
          if (grants.length !== 1)
            throw new ConflictException('nodia_ai:execution_conflict');
          const descriptor = {
            schema_version: 1,
            kind: 'human_execution_resume',
            actor_id: loaded.actor.actorId,
            session_public_id: loaded.actor.sessionId,
            execution_revision: execution.revision + 1,
            expected_execution_revision: request.expected_execution_revision,
            client_request_id: request.client_request_id,
            proposal_hash: execution.proposal_hash,
          };
          await manager.query(
            `UPDATE nodia_ai_jobs SET state='ready',available_at=$2,deadline_at=$3,lease_owner=NULL,lease_until=NULL,
          fence=fence+1,recovery_descriptor=$4::jsonb,updated_at=$2 WHERE id=$1`,
            [job.id, admitted, deadline, JSON.stringify(descriptor)],
          );
          await manager.query(
            `UPDATE nodia_ai_execution_steps SET state='ready',error_code=NULL,recovery_descriptor=NULL,lease_fence=$2 WHERE execution_id=$1 AND state<>'completed'`,
            [key, (BigInt(job.fence) + 1n).toString()],
          );
          await manager.query(
            'UPDATE nodia_ai_conversations SET active_job_id=$2 WHERE id=$1',
            [loaded.chat.id, job.id],
          );
          nextState = 'queued';
        } else {
          if (
            ![
              'queued',
              'running',
              'waiting_for_user',
              'cancel_requested',
              'unknown',
              'failed',
              'partially_completed',
            ].includes(execution.state)
          )
            throw new ConflictException('nodia_ai:execution_conflict');
          if (loaded.chat.active_job_id && loaded.chat.active_job_id !== job.id)
            throw new ConflictException('nodia_ai:conversation_busy');
          await manager.query(
            `UPDATE nodia_ai_jobs SET state='cancelled',lease_owner=NULL,lease_until=NULL,fence=fence+1,updated_at=$2 WHERE id=$1`,
            [job.id, now],
          );
          await manager.query(
            `UPDATE nodia_ai_job_attempts SET phase='cancelled',ended_at=$2 WHERE job_id=$1 AND ended_at IS NULL`,
            [job.id, now],
          );
          await manager.query(
            `UPDATE nodia_ai_execution_steps SET state='cancelled',error_code=NULL,recovery_descriptor=NULL,lease_fence=$2 WHERE execution_id=$1 AND state<>'completed'`,
            [key, (BigInt(job.fence) + 1n).toString()],
          );
          await manager.query(
            'UPDATE nodia_ai_execution_grants SET revoked_at=COALESCE(revoked_at,$2) WHERE execution_id=$1',
            [key, now],
          );
          await manager.query(
            'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
            [loaded.chat.id, job.id],
          );
          nextState = next > 0 ? 'partially_completed' : 'cancelled';
        }
        await manager.query(
          'UPDATE nodia_ai_executions SET state=$2,revision=revision+1,completed_at=$3 WHERE id=$1',
          [key, nextState, operation === 'cancel' ? now : null],
        );
        execution.state = nextState;
        execution.revision++;
        execution.completed_at = operation === 'cancel' ? now : null;
        await appendNodiaAiExecutionEvent(manager, {
          conversationId: loaded.chat.id,
          executionId: key,
          eventKey: `execution:${key}:${execution.revision}:${nextState}`,
          payload: {
            revision: execution.revision,
            state: nextState,
            error: null,
          },
          moduleRoutes: modules,
          maxEvents: this.policy.results.outbox_events_per_activity,
        });
        const result =
          operation === 'cancel'
            ? {
                status: 'accepted',
                execution: await this.status.project(
                  manager,
                  execution,
                  now,
                  loaded.steps,
                ),
              }
            : {
                execution: await this.status.project(
                  manager,
                  execution,
                  now,
                  loaded.steps,
                ),
              };
        this.validate.assert(
          operation === 'cancel'
            ? 'ExecutionCancellationResult'
            : 'ExecutionAccepted',
          result,
          true,
        );
        return result;
      })
      .catch((error: unknown) => {
        if (error instanceof QueryFailedError) {
          const driver: unknown = error.driverError;
          if (
            driver &&
            typeof driver === 'object' &&
            'code' in driver &&
            (driver.code === '55P03' || driver.code === '57014')
          )
            throw new ConflictException('nodia_ai:execution_busy');
        }
        throw error;
      });
    if (outcome instanceof HttpException) throw outcome;
    return outcome;
  }
}
