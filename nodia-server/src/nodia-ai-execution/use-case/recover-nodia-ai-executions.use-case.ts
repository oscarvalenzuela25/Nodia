import { Inject, Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import { nodiaAiLocalOperationIdentity } from '../../nodia-ai-proposal/types/local-operation.types.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import { nextNodiaAiExecutionStep } from '../types/sequential-execution.js';
import type { NodiaAiExecutionClaim } from '../types/execution-claim.types.js';

/** SQL-only reconciliation. Taking the effect locks proves its transaction has ended.
 * Without the atomic receipt the native SQL effect did not commit; never call it here. */
@Injectable()
export class RecoverNodiaAiExecutionsUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    failedClaim?: NodiaAiExecutionClaim,
    errorCode = 'nodia_ai:lease_lost',
  ): Promise<number> {
    const safeError = /^nodia_ai:[a-z0-9_]{1,100}$/.test(errorCode)
      ? errorCode
      : 'nodia_ai:execution_conflict';
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      let count = 0;
      if (!failedClaim) {
        // Retention intentionally removed all prompts and proposal rows. A local
        // SQL attempt has no remote process to recover: lock its retained identity
        // before disposing the minimal journal; business records are independent.
        const detached: { id: string; execution_id: string }[] =
          await manager.query(
            `SELECT j.id,j.recovery_descriptor->>'execution_id' AS execution_id FROM nodia_ai_jobs j
           WHERE j.kind='execution' AND j.state='unknown' AND j.execution_id IS NULL AND j.conversation_id IS NULL
             AND NOT COALESCE(j.recovery_descriptor ? 'restore_quarantined',false)
             AND j.recovery_descriptor->>'reason'='chat_expired'
             AND j.recovery_descriptor->>'execution_id' ~ '^[a-f0-9-]{36}$'
           ORDER BY j.id FOR UPDATE SKIP LOCKED LIMIT $1`,
            [this.policy.retention.batch_chats],
          );
        for (const orphan of detached) {
          const execution = await this.store.execution(
            manager,
            orphan.execution_id,
            true,
          );
          if (
            !execution ||
            execution.conversation_id !== null ||
            execution.proposal_id !== null
          )
            continue;
          const steps = await this.store.steps(manager, execution.id);
          const attempts: {
            phase: string;
            external_operation_ref: string | null;
            runtime_resource_key: string | null;
          }[] = await manager.query(
            'SELECT phase,external_operation_ref,runtime_resource_key FROM nodia_ai_job_attempts WHERE job_id=$1 FOR UPDATE',
            [orphan.id],
          );
          if (
            !steps.length ||
            steps.length > this.policy.budget.steps_per_proposal ||
            nextNodiaAiExecutionStep(steps) < 0 ||
            steps.some(
              (step) => !nodiaAiLocalOperationIdentity(step.tool_name),
            ) ||
            attempts.some(
              (a) =>
                !['claimed', 'abandoned', 'completed'].includes(a.phase) ||
                a.external_operation_ref !== null ||
                a.runtime_resource_key !== null,
            )
          )
            continue;
          const known = steps.every((step) => {
            const knownRollback =
              step.minimal_receipt === null &&
              step.dispatched_at === null &&
              step.completed_at === null;
            const knownCommit =
              step.state === 'completed' &&
              !!step.completed_at &&
              !!step.dispatched_at &&
              step.minimal_receipt?.schema_version === 1 &&
              step.minimal_receipt.resource_key ===
                nodiaAiLocalOperationIdentity(step.tool_name)?.resourceKey &&
              (step.tool_name === 'nodia_finance_movements_prepare_create' ||
                step.minimal_receipt.operation ===
                  nodiaAiLocalOperationIdentity(step.tool_name)?.operation) &&
              typeof step.bound_command_hash === 'string';
            return knownRollback || knownCommit;
          });
          if (!known) continue;
          await manager.query(
            'DELETE FROM nodia_ai_job_attempts WHERE job_id=$1',
            [orphan.id],
          );
          await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [
            orphan.id,
          ]);
          await manager.query('DELETE FROM nodia_ai_executions WHERE id=$1', [
            execution.id,
          ]);
          count++;
        }
      }
      const candidates: { execution_id: string; conversation_id: string }[] =
        await manager.query(
          `SELECT j.execution_id,j.conversation_id FROM nodia_ai_jobs j
         JOIN nodia_ai_executions e ON e.id=j.execution_id JOIN nodia_ai_conversations c ON c.id=j.conversation_id
         LEFT JOIN nodia_ai_execution_grants g ON g.execution_id=e.id
         LEFT JOIN auth_sessions s ON s.public_id=g.session_public_id AND s.user_id=g.actor_id
         WHERE j.kind='execution'
         AND NOT COALESCE(j.recovery_descriptor ? 'restore_quarantined',false) AND j.state IN ('ready','leased','unknown') AND e.state IN ('queued','running','cancel_requested','unknown')
         AND (($2::uuid IS NOT NULL AND j.id=$2::uuid) OR ($2::uuid IS NULL AND (j.state='unknown' OR j.lease_until<=clock_timestamp() OR j.deadline_at<=clock_timestamp()
           OR (j.state='ready' AND j.available_at+$3*interval '1 second'<=clock_timestamp())
           OR c.expires_at<=clock_timestamp() OR c.lifecycle<>'active' OR e.state='cancel_requested'
           OR g.id IS NULL OR g.revoked_at IS NOT NULL OR g.expires_at<=clock_timestamp() OR s.public_id IS NULL OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp())))
         ORDER BY j.available_at,j.id LIMIT $1`,
          [
            this.policy.retention.batch_chats,
            failedClaim?.jobId ?? null,
            this.policy.queue.wait_seconds,
          ],
        );
      for (const candidate of candidates) {
        const chat = await this.store.chat(manager, candidate.conversation_id);
        const jobs = await this.store.jobs(manager, candidate.execution_id);
        const execution = await this.store.execution(
          manager,
          candidate.execution_id,
          true,
        );
        const steps = await this.store.steps(manager, candidate.execution_id);
        const grants = await this.store.grants(manager, candidate.execution_id);
        const next = nextNodiaAiExecutionStep(steps);
        const job = jobs[0],
          step = steps[next],
          grant = grants[0],
          now = await this.store.now(manager);
        if (
          !chat ||
          job?.recovery_descriptor?.restore_quarantined !== undefined ||
          !execution ||
          jobs.length !== 1 ||
          !steps.length ||
          steps.length > this.policy.budget.steps_per_proposal ||
          !step ||
          execution.state === 'completed' ||
          (!nodiaAiLocalOperationIdentity(step.tool_name) &&
            !(
              nodiaAiSecureOperationIdentity(step.tool_name) &&
              step.recovery_descriptor === null
            )) ||
          step.state === 'completed' ||
          !['ready', 'leased', 'unknown'].includes(job.state) ||
          execution.revision >= 2147483647
        )
          continue;
        if (
          failedClaim &&
          job.id === failedClaim.jobId &&
          (job.fence !== failedClaim.fence ||
            job.lease_owner !== failedClaim.workerId)
        )
          continue;
        // An inconsistent or externally dispatched witness must remain uncertain.
        const uncertain =
          step.minimal_receipt !== null ||
          step.dispatched_at !== null ||
          step.completed_at !== null;
        const cancelled =
          execution.state === 'cancel_requested' ||
          chat.lifecycle !== 'active' ||
          chat.expires_at <= now;
        const expired =
          job.deadline_at <= now ||
          (job.state === 'ready' &&
            job.available_at.getTime() +
              this.policy.queue.wait_seconds * 1000 <=
              now.getTime());
        const hasCompleted = next > 0;
        const stepState = uncertain
          ? 'unknown'
          : cancelled
            ? 'cancelled'
            : 'failed';
        const state = uncertain
          ? 'unknown'
          : hasCompleted
            ? 'partially_completed'
            : stepState;
        if (
          uncertain &&
          execution.state === 'unknown' &&
          step.state === 'unknown' &&
          job.state === 'unknown'
        )
          continue;
        const error = uncertain
          ? 'nodia_ai:outcome_unknown'
          : cancelled
            ? 'nodia_ai:cancelled'
            : expired
              ? 'nodia_ai:execution_expired'
              : safeError;
        await manager.query(
          `UPDATE nodia_ai_jobs SET state=$2,fence=fence+1,lease_owner=NULL,lease_until=NULL,updated_at=$3 WHERE id=$1`,
          [job.id, stepState, now],
        );
        await manager.query(
          `UPDATE nodia_ai_job_attempts SET phase=$2,error_code=$3,ended_at=$4 WHERE job_id=$1 AND ended_at IS NULL`,
          [job.id, uncertain ? 'unknown' : 'abandoned', error, now],
        );
        await manager.query(
          `UPDATE nodia_ai_execution_steps SET state=$2,error_code=$3,recovery_descriptor=$4::jsonb WHERE id=$1`,
          [
            step.id,
            stepState,
            error,
            uncertain
              ? JSON.stringify(step.recovery_descriptor)
              : JSON.stringify({
                  schema_version: 1,
                  kind: 'local_transaction_rolled_back',
                }),
          ],
        );
        if (cancelled && !uncertain)
          await manager.query(
            "UPDATE nodia_ai_execution_steps SET state='cancelled',error_code=NULL,recovery_descriptor=NULL WHERE execution_id=$1 AND state<>'completed' AND id<>$2",
            [execution.id, step.id],
          );
        await manager.query(
          `UPDATE nodia_ai_executions SET state=$2,revision=revision+1,completed_at=$3::timestamptz WHERE id=$1`,
          [execution.id, state, cancelled && !uncertain ? now : null],
        );
        await manager.query(
          `UPDATE nodia_ai_execution_grants SET revoked_at=$2 WHERE execution_id=$1 AND revoked_at IS NULL`,
          [execution.id, now],
        );
        if (state !== 'unknown')
          await manager.query(
            `UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2`,
            [chat.id, job.id],
          );
        await appendNodiaAiExecutionEvent(manager, {
          conversationId: chat.id,
          executionId: execution.id,
          eventKey: `execution:${execution.id}:${execution.revision + 1}:${state}`,
          payload: {
            revision: execution.revision + 1,
            state,
            error: {
              code: error,
              message_key: error,
              field_errors: [],
              retry_action: state === 'unknown' ? 'recover_status' : 'none',
              correlation_id: execution.id,
            },
          },
          moduleRoutes: grant?.allowed_modules ?? [],
          maxEvents: this.policy.results.outbox_events_per_activity,
        });
        count++;
      }
      return count;
    });
  }
}
