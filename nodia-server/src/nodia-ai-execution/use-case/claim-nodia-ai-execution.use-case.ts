import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiExecution } from '../../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import type { NodiaAiExecutionClaim } from '../types/execution-claim.types.js';
import { nextNodiaAiExecutionStep } from '../types/sequential-execution.js';

/** Claims one local transactional effect. No model/profile capacity is consumed. */
@Injectable()
export class ClaimNodiaAiExecutionUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(workerId: string): Promise<NodiaAiExecutionClaim | null> {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        workerId,
      )
    )
      throw new Error('nodia_ai_invalid_worker_identity');
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      await lockNodiaAiQueue(manager);
      const candidate = await this.store.candidate(
        manager,
        this.policy.queue.foreground_workers,
        this.policy.queue.active_per_owner,
        this.policy.queue.wait_seconds,
      );
      if (!candidate) return null;
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
        grants.length !== 1 ||
        !grant.session_public_id ||
        grant.revoked_at ||
        grant.expires_at <= now ||
        execution.state !== 'queued' ||
        execution.actor_id !== chat.owner_id ||
        execution.retention_epoch !== chat.retention_epoch ||
        job.id !== candidate.id ||
        chat.active_job_id !== job.id ||
        job.state !== 'ready' ||
        job.stage_key !== 'execution_step' ||
        job.stage_seq !== next + 1 ||
        step.state !== 'ready' ||
        step.minimal_receipt !== null ||
        step.dispatched_at !== null ||
        step.completed_at !== null ||
        (job.recovery_descriptor !== null &&
          job.recovery_descriptor.kind !== 'human_execution_resume') ||
        execution.revision >= 2147483647 ||
        job.attempt_count >= 2147483647 ||
        BigInt(job.fence) >= 9223372036854775807n
      )
        return null;
      const identity = {
        userId: grant.actor_id,
        sessionId: grant.session_public_id,
      };
      if (!execution.proposal_id) return null;
      // A claim reserves delivery, never authority to execute. Current permissions
      // are checked inside the effect transaction; a denial is then durably failed
      // by Run/Recover rather than rolling back the claim and starving the queue.
      job.state = 'leased';
      job.fence = (BigInt(job.fence) + 1n).toString();
      job.attempt_count++;
      job.lease_owner = workerId;
      job.lease_until = new Date(
        Math.min(
          now.getTime() + this.policy.timing.lease_seconds * 1000,
          job.deadline_at.getTime(),
          grant.expires_at.getTime(),
          chat.expires_at.getTime(),
        ),
      );
      job.updated_at = now;
      execution.state = 'running';
      execution.revision++;
      step.state = 'running';
      step.lease_fence = job.fence;
      step.recovery_descriptor = null;
      step.error_code = null;
      const attempt = Object.assign(new NodiaAiJobAttempt(), {
        id: randomUUID(),
        job_id: job.id,
        attempt_no: job.attempt_count,
        fence: job.fence,
        worker_id: workerId,
        phase: 'claimed',
        error_code: null,
        external_operation_ref: null,
        started_at: now,
        ended_at: null,
        runtime_resource_key: null,
        runtime_fence: null,
        stage_key: 'execution_step',
        stage_seq: next + 1,
        selection_snapshot: null,
        routing_phase: null,
      });
      await manager.getRepository(NodiaAiJob).save(job);
      await manager.getRepository(NodiaAiExecution).save(execution);
      await manager.getRepository(NodiaAiExecutionStep).save(step);
      await manager.getRepository(NodiaAiJobAttempt).insert(attempt);
      await appendNodiaAiExecutionEvent(manager, {
        conversationId: chat.id,
        executionId: execution.id,
        eventKey: `execution:${execution.id}:${execution.revision}:running`,
        payload: {
          revision: execution.revision,
          state: 'running',
          error: null,
        },
        moduleRoutes: grant.allowed_modules,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      return {
        executionId: execution.id,
        identity,
        jobId: job.id,
        attemptId: attempt.id,
        workerId,
        fence: job.fence,
        toolName: step.tool_name,
      };
    });
  }
}
