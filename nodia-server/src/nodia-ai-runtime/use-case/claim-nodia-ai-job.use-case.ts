import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiJob } from '../entities/nodia-ai-job.entity.js';
import { NodiaAiJobAttempt } from '../entities/nodia-ai-job-attempt.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import { lockNodiaAiQueue } from '../queue-lock.js';
import { publishNodiaAiRunChanged } from '../../nodia-ai-run/event-journal.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import {
  NODIA_AI_CHAT_OPERATION,
  type NodiaAiClaim,
} from '../types/worker.types.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

@Injectable()
export class ClaimNodiaAiJobUseCase {
  constructor(
    private readonly runtime: NodiaAiRuntimeService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    workerId: string,
    catalogVersions: readonly string[],
  ): Promise<NodiaAiClaim | null> {
    if (
      !uuid.test(workerId) ||
      catalogVersions.length > 32 ||
      catalogVersions.some(
        (value) => typeof value !== 'string' || !value || value.length > 256,
      )
    )
      throw new Error('nodia_ai_invalid_worker_identity');
    if (catalogVersions.length === 0) return null;
    return this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const candidate = await this.runtime.candidate(
        manager,
        this.policy.policyHash,
        catalogVersions,
        this.policy.queue.foreground_workers,
        this.policy.queue.active_per_owner,
        this.policy.queue.wait_seconds,
      );
      if (!candidate) return null;
      const conversation = await this.runtime.lockConversation(
        manager,
        candidate,
      );
      if (!conversation?.active_job_id) return null;
      const job = await this.runtime.lockJob(
        manager,
        conversation.active_job_id,
      );
      if (!job?.run_id || job.state !== 'ready' || job.recovery_descriptor?.restore_quarantined !== undefined) return null;
      const run = await this.runtime.findRun(manager, job.run_id);
      const grant = await this.runtime.findRunGrant(manager, job.run_id);
      const now = await this.runtime.now(manager);
      if (
        !run ||
        !grant ||
        !grant.session_public_id ||
        grant.revoked_at ||
        grant.expires_at <= now ||
        !grant.allowed_operations.includes(NODIA_AI_CHAT_OPERATION) ||
        run.actor_id !== grant.actor_id ||
        run.actor_id !== conversation.owner_id ||
        run.state !== 'queued' ||
        run.retention_epoch !== conversation.retention_epoch ||
        run.policy_hash !== this.policy.policyHash ||
        !catalogVersions.includes(run.catalog_version) ||
        grant.policy_version !== run.policy_version ||
        job.deadline_at <= now ||
        run.deadline_at <= now ||
        conversation.expires_at <= now ||
        conversation.lifecycle !== 'active'
      ) {
        await this.reject(manager, job, 'nodia_ai:grant_invalid');
        return null;
      }
      const identity = {
        userId: grant.actor_id,
        sessionId: grant.session_public_id,
      };
      try {
        await this.authorize.execute(
          identity,
          { moduleRoutes: grant.allowed_modules },
          manager,
        );
      } catch {
        await this.reject(manager, job, 'nodia_ai:capability_denied');
        return null;
      }
      job.fence = (BigInt(job.fence) + 1n).toString();
      job.attempt_count += 1;
      job.state = 'leased';
      job.lease_owner = workerId;
      job.lease_until = new Date(
        Math.min(
          now.getTime() + this.policy.timing.lease_seconds * 1000,
          job.deadline_at.getTime(),
        ),
      );
      job.updated_at = now;
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
        stage_key: job.stage_key,
        stage_seq: job.stage_seq,
        selection_snapshot: run.selection_snapshot,
        routing_phase: 'base',
      });
      await manager.getRepository(NodiaAiJob).save(job);
      await manager.getRepository(NodiaAiJobAttempt).insert(attempt);
      run.state = 'running';
      run.phase = job.stage_key;
      await manager.getRepository(NodiaAiRun).save(run);
      run.revision = await publishNodiaAiRunChanged(manager, {
        conversationId: conversation.id,
        runId: run.id,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      return { job, attempt, run, identity };
    });
  }
  private async reject(
    manager: import('typeorm').EntityManager,
    job: NodiaAiJob,
    errorCode: string,
  ) {
    await manager.query(
      "UPDATE nodia_ai_jobs SET state='failed',lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",
      [job.id],
    );
    await manager.query(
      "UPDATE nodia_ai_runs SET state='failed',error_code=$2,completed_at=clock_timestamp() WHERE id=$1",
      [job.run_id, errorCode],
    );
    await manager.query(
      'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
      [job.conversation_id, job.id],
    );
    await manager.query(
      'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE run_id=$1 AND revoked_at IS NULL',
      [job.run_id],
    );
    await publishNodiaAiRunChanged(manager, {
      conversationId: job.conversation_id!,
      runId: job.run_id!,
      maxEvents: this.policy.results.outbox_events_per_activity,
    });
  }
}
