import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import { NodiaAiRuntimeReconciliationPort } from '../types/reconciliation.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import { lockNodiaAiQueue } from '../queue-lock.js';
import { publishNodiaAiRunChanged } from '../../nodia-ai-run/event-journal.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
  terminalRuntimeProofDescriptor,
} from './runtime-reconciliation-descriptor.js';
import { CleanupNodiaAiRuntimeProofsUseCase } from './cleanup-nodia-ai-runtime-proofs.use-case.js';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
@Injectable()
export class ReconcileNodiaAiRuntimeUseCase {
  constructor(
    private readonly runtime: NodiaAiRuntimeService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly native: NodiaAiRuntimeReconciliationPort,
    private readonly cleanup: CleanupNodiaAiRuntimeProofsUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async list(identity: NodiaAiActorReference) {
    return this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await this.admin(manager, identity);
      const rows: {
        job_id: string;
        kind: string;
        state: string;
        fence: string;
        updated_at: Date;
      }[] = await manager.query(
        `SELECT id::text AS job_id,kind,state,fence::text,updated_at FROM nodia_ai_jobs WHERE (kind='turn' AND state='unknown') OR (kind='reconcile' AND state<>'done') ORDER BY updated_at,id LIMIT $1`,
        [this.policy.results.list_default_rows],
      );
      return rows.map((row) => ({
        ...row,
        updated_at: row.updated_at.toISOString(),
      }));
    });
  }
  async execute(identity: NodiaAiActorReference, jobId: string) {
    if (!uuid.test(jobId))
      throw new NotFoundException('nodia_ai:resource_not_found');
    const snapshot = await this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      await this.admin(manager, identity);
      const job = await this.runtime.findJob(manager, jobId);
      if (!job) throw new NotFoundException('nodia_ai:resource_not_found');
      if (job.recovery_descriptor?.restore_quarantined !== undefined)
        throw new ConflictException('nodia_ai:restore_reconciliation_required');
      if (job.kind === 'reconcile' && job.stage_key === 'reconcile_ack')
        return { cleanup: true as const };
      if (job.kind !== 'turn' || job.state !== 'unknown')
        throw new ConflictException('nodia_ai:reconciliation_not_pending');
      const request = readRuntimeProofRequest(job.recovery_descriptor);
      const slot = await this.runtime.findSlot(manager, request.resourceKey);
      if (
        !slot ||
        slot.state !== 'unknown' ||
        slot.external_operation_ref !== request.operationRef
      )
        throw new ConflictException('nodia_ai:reconciliation_changed');
      const attempt = await this.runtime.findAttempt(
        manager,
        job.id,
        request.attemptId,
      );
      if (
        !attempt ||
        attempt.runtime_resource_key !== request.resourceKey ||
        attempt.external_operation_ref !== request.operationRef
      )
        throw new ConflictException('nodia_ai:reconciliation_changed');
      return { cleanup: false as const, job, slot, request };
    });
    if (snapshot.cleanup) {
      const result = await this.cleanup.execute(jobId, true);
      return {
        job_id: jobId,
        resolved: true,
        cleanup_pending: result.settled === 0,
      };
    }
    const proof = await this.native.reconcile(
      snapshot.request,
      AbortSignal.timeout(this.policy.timing.domain_step_seconds * 1000),
    );
    try {
      assertRuntimeTerminalProof(snapshot.request, proof);
    } catch {
      throw new ConflictException('nodia_ai:invalid_terminal_proof');
    }
    await this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      await this.admin(manager, identity);
      if (snapshot.job.conversation_id)
        await this.runtime.lockConversation(
          manager,
          snapshot.job.conversation_id,
        );
      const job = await this.runtime.lockJob(manager, jobId);
      const slots: {
        fence: string;
        state: string;
        external_operation_ref: string | null;
      }[] = await manager.query(
        'SELECT fence::text,state,external_operation_ref FROM nodia_ai_runtime_slots WHERE resource_key=$1 FOR UPDATE',
        [snapshot.request.resourceKey],
      );
      const slot = slots[0];
      if (
        !job ||
        job.state !== 'unknown' ||
        job.kind !== 'turn' ||
        job.fence !== snapshot.job.fence ||
        !slot ||
        slot.state !== 'unknown' ||
        slot.fence !== snapshot.slot.fence ||
        slot.external_operation_ref !== snapshot.request.operationRef ||
        JSON.stringify(job.recovery_descriptor) !==
          JSON.stringify(snapshot.job.recovery_descriptor)
      )
        throw new ConflictException('nodia_ai:reconciliation_changed');
      const descriptor = terminalRuntimeProofDescriptor(proof);
      if (job.run_id) {
        await manager.query(
          "UPDATE nodia_ai_runs SET state='failed',error_code=$2,completed_at=clock_timestamp() WHERE id=$1",
          [
            job.run_id,
            proof.outcome === 'completed'
              ? 'nodia_ai:response_unavailable'
              : 'nodia_ai:outcome_unknown',
          ],
        );
        await manager.query(
          'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE run_id=$1 AND revoked_at IS NULL',
          [job.run_id],
        );
        await publishNodiaAiRunChanged(manager, {
          conversationId: job.conversation_id!,
          runId: job.run_id,
          maxEvents: this.policy.results.outbox_events_per_activity,
        });
      }
      if (job.conversation_id)
        await manager.query(
          'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
          [job.conversation_id, job.id],
        );
      await manager.query(
        "UPDATE nodia_ai_runtime_slots SET state='free',fence=fence+1,conversation_id=NULL,job_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,updated_at=clock_timestamp() WHERE resource_key=$1",
        [snapshot.request.resourceKey],
      );
      await manager.query(
        "UPDATE nodia_ai_job_attempts SET phase='reconciled',selection_snapshot=NULL,routing_phase=NULL,error_code=$2,ended_at=COALESCE(ended_at,clock_timestamp()) WHERE job_id=$1",
        [
          job.id,
          proof.outcome === 'completed'
            ? 'nodia_ai:response_unavailable'
            : 'nodia_ai:outcome_unknown',
        ],
      );
      await manager.query(
        "UPDATE nodia_ai_jobs SET kind='reconcile',state='waiting',stage_key='reconcile_ack',stage_seq=stage_seq+1,fence=fence+1,lease_owner=NULL,lease_until=NULL,available_at=clock_timestamp(),deadline_at=clock_timestamp()+$3*interval '1 second',recovery_descriptor=$2::jsonb,updated_at=clock_timestamp() WHERE id=$1",
        [
          job.id,
          JSON.stringify(descriptor),
          this.policy.retention.physical_cleanup_target_seconds,
        ],
      );
    });
    const result = await this.cleanup.execute(jobId);
    return {
      job_id: jobId,
      resolved: true,
      cleanup_pending: result.settled === 0,
    };
  }
  private async admin(manager: EntityManager, identity: NodiaAiActorReference) {
    const actor = await this.authorize.execute(identity, {}, manager);
    if (!actor.isSuperAdmin)
      throw new ForbiddenException('nodia_ai:super_admin_required');
  }
}
