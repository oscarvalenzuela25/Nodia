import { Inject, Injectable } from '@nestjs/common';
import { armChatGeneration,finishChatGeneration } from '../../ai-generation/chat-generation-ownership.js';
import { assertNativeDispatchRejection } from '../types/native-dispatch-rejection.js';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import {
  NodiaAiLostLeaseError,
  NodiaAiKnownPreDispatchError,
  NODIA_AI_CHAT_OPERATION,
  type NodiaAiClaim,
  type NodiaAiRuntimeReservation,
  type NodiaAiStageOutcome,
} from '../types/worker.types.js';
import { lockNodiaAiQueue } from '../queue-lock.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
  runtimeProofDescriptor,
  terminalRuntimeProofDescriptor,
} from './runtime-reconciliation-descriptor.js';
import { randomUUID } from 'node:crypto';
import { publishNodiaAiRunChanged } from '../../nodia-ai-run/event-journal.js';
@Injectable()
export class CheckpointNodiaAiJobUseCase {
  constructor(
    private readonly runtime: NodiaAiRuntimeService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute<T>(
    claim: NodiaAiClaim,
    work: (manager: EntityManager) => Promise<T>,
    isolation?: 'REPEATABLE READ',
  ): Promise<T> {
    return this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const conversation = await this.runtime.lockConversation(
        manager,
        claim.job.conversation_id!,
      );
      const job = await this.runtime.lockJob(manager, claim.job.id);
      const now = await this.runtime.now(manager);
      const run = job?.run_id
        ? await this.runtime.findRun(manager, job.run_id)
        : null;
      if (
        !conversation ||
        !job ||
        job.recovery_descriptor?.restore_quarantined !== undefined ||
        !run ||
        job.run_id !== claim.run.id ||
        job.conversation_id !== claim.run.conversation_id ||
        run.actor_id !== claim.identity.userId ||
        run.actor_id !== conversation.owner_id ||
        job.state !== 'leased' ||
        job.fence !== claim.job.fence ||
        job.lease_owner !== claim.attempt.worker_id ||
        !job.lease_until ||
        job.lease_until <= now ||
        job.deadline_at <= now ||
        run.deadline_at <= now ||
        conversation.active_job_id !== job.id ||
        conversation.lifecycle !== 'active' ||
        conversation.expires_at <= now ||
        conversation.retention_epoch !== claim.run.retention_epoch ||
        run.retention_epoch !== conversation.retention_epoch ||
        run.policy_hash !== this.policy.policyHash ||
        run.state !== 'running'
      )
        throw new NodiaAiLostLeaseError();
      const grant = await this.runtime.findRunGrant(manager, run.id);
      if (
        !grant ||
        !grant.session_public_id ||
        grant.revoked_at ||
        grant.expires_at <= now ||
        !grant.allowed_operations.includes(NODIA_AI_CHAT_OPERATION) ||
        grant.actor_id !== claim.identity.userId ||
        grant.session_public_id !== claim.identity.sessionId ||
        grant.policy_version !== run.policy_version
      )
        throw new NodiaAiLostLeaseError();
      await this.authorize.execute(
        claim.identity,
        { moduleRoutes: grant.allowed_modules },
        manager,
      );
      return work(manager);
    }, isolation);
  }
  async heartbeat(claim: NodiaAiClaim): Promise<void> {
    await this.execute(claim, async (manager) => {
      await manager.query(
        "UPDATE nodia_ai_jobs SET lease_until=LEAST(clock_timestamp()+$2*interval '1 second',deadline_at),updated_at=clock_timestamp() WHERE id=$1",
        [claim.job.id, this.policy.timing.lease_seconds],
      );
      await manager.query(
        "UPDATE nodia_ai_runtime_slots SET lease_until=LEAST(clock_timestamp()+$3*interval '1 second',$4::timestamptz),updated_at=clock_timestamp() WHERE state='held' AND job_id=$1 AND holder_worker_id=$2 AND lease_until>clock_timestamp()",
        [
          claim.job.id,
          claim.attempt.worker_id,
          this.policy.timing.lease_seconds,
          claim.job.deadline_at,
        ],
      );
    });
  }
  async armDispatch(
    claim: NodiaAiClaim,
    selection: NodiaAiSelection = claim.run.selection_snapshot,
    runtime?: NodiaAiRuntimeReservation,
    validate?: (manager: EntityManager) => Promise<void>,
    onLocalRejection?: (error: NodiaAiKnownPreDispatchError) => void,
  ): Promise<void> {
    await this.execute(claim, async (manager) => {
      const rejectBeforeArming: (code: string) => never = (code) => {
        const error = new NodiaAiKnownPreDispatchError(code);
        // This exact error originates before the durable dispatch phase is written.
        // A replaced/lost transaction response must still be treated as unknown.
        onLocalRejection?.(error);
        throw error;
      };
      // Local, trusted checks share the authority/fence transaction with budget arming.
      // Never perform storage, provider or other network I/O in this callback.
      await validate?.(manager);
      const attempt = await this.runtime.findAttempt(
        manager,
        claim.job.id,
        claim.attempt.id,
      );
      if (!attempt || attempt.phase !== 'claimed')
        throw new NodiaAiLostLeaseError();
      const sameSelection = (left: NodiaAiSelection, right: NodiaAiSelection) =>
        left.connection_id === right.connection_id &&
        left.mode === right.mode &&
        left.model_id === right.model_id &&
        left.effort_id === right.effort_id;
      const delegated = !sameSelection(selection, claim.run.selection_snapshot);
      if (
        delegated &&
        (runtime?.adapterIdentity !== undefined ||
          claim.run.context_manifest.adapter_identity !== undefined)
      )
        rejectBeforeArming('nodia_ai:invalid_selection');
      if (
        claim.job.stage_key === 'delegated_inference' ||
        claim.attempt.routing_phase === 'delegated' ||
        claim.run.routing_snapshot.enabled ||
        claim.run.routing_snapshot.target !== null
      )
        rejectBeforeArming('nodia_ai:mode_retired');
      if (delegated) rejectBeforeArming('nodia_ai:invalid_selection');
      if (!['agentic', 'api_key'].includes(selection.mode)) rejectBeforeArming('nodia_ai:mode_retired');
      if (!runtime) throw new NodiaAiLostLeaseError();
      const sessionGeneration = claim.run.context_manifest.session_generation;
      let descriptor: ReturnType<typeof runtimeProofDescriptor> | undefined;
      if (
        runtime?.adapterIdentity !== undefined ||
        claim.run.context_manifest.adapter_identity !== undefined
      ) {
        const identity = runtime?.adapterIdentity;
        const stored = claim.run.context_manifest.adapter_identity;
        if (
          delegated ||
          selection.mode !==
            (identity?.contractVersion === 'nodia-ai-api-chat/1'
              ? 'api_key'
              : 'agentic') ||
          !runtime ||
          !identity ||
          !stored ||
          typeof stored !== 'object' ||
          Array.isArray(stored) ||
          Object.keys(stored).length !== 3 ||
          stored.provider_key !== identity.providerKey ||
          stored.contract_version !== identity.contractVersion ||
          stored.connection_id !== identity.connectionId ||
          identity.connectionId !== selection.connection_id ||
          runtime.sessionGeneration !== sessionGeneration ||
          typeof sessionGeneration !== 'string'
        )
          rejectBeforeArming('nodia_ai:eligibility_changed');
        try {
          const reference = {
            attemptId: claim.attempt.id,
            operationRef: runtime.operationRef,
            resourceKey: runtime.resourceKey,
            sessionGeneration,
          };
          descriptor = runtimeProofDescriptor(
            identity.contractVersion === 'nodia-ai-api-chat/1'
              ? { ...reference, engine: 'api_key', adapterIdentity: identity }
              : { ...reference, engine: 'agentic', adapterIdentity: identity },
          );
        } catch {
          rejectBeforeArming('nodia_ai:eligibility_changed');
        }
      } else if (
        runtime?.resourceKey.startsWith('codex-profile:') ||
        selection.mode === 'api_key'
      ) {
        // A Codex resource without an explicit identity must never become a Gemini descriptor.
        rejectBeforeArming('nodia_ai:eligibility_changed');
      } else if (
        runtime &&
        typeof sessionGeneration === 'string' &&
        /^[a-f0-9]{32}$/.test(sessionGeneration)
      ) {
        descriptor = runtimeProofDescriptor({
          engine: 'agentic',
          attemptId: claim.attempt.id,
          operationRef: runtime.operationRef,
          resourceKey: runtime.resourceKey,
          sessionGeneration,
        });
      }
      if (runtime) {
        const slots: {
          resource_key: string;
        }[] = await manager.query(
          "SELECT resource_key FROM nodia_ai_runtime_slots WHERE resource_key=$1 AND state='held' AND job_id=$2 AND holder_worker_id=$3 AND fence=$4 AND external_operation_ref=$5 AND lease_until>clock_timestamp() FOR UPDATE",
          [
            runtime.resourceKey,
            claim.job.id,
            claim.attempt.worker_id,
            runtime.fence,
            runtime.operationRef,
          ],
        );
        if (
          slots.length !== 1 ||
          !runtime.operationRef ||
          Buffer.byteLength(runtime.operationRef) > 512
        )
          throw new NodiaAiLostLeaseError();
      }
      const changed: {
        id: string;
      }[] = await manager.query(
        "WITH changed AS (UPDATE nodia_ai_runs SET provider_dispatches_used=provider_dispatches_used+1 WHERE id=$1 AND provider_dispatches_used < (budget_snapshot->>'provider_dispatches')::integer RETURNING id) SELECT id FROM changed",
        [claim.run.id],
      );
      if (changed.length !== 1) rejectBeforeArming('nodia_ai:execution_limit');
      await manager.query(
        "UPDATE nodia_ai_job_attempts SET phase='dispatch_armed',selection_snapshot=$2::jsonb,routing_phase=$3,runtime_resource_key=$4,runtime_fence=$5,external_operation_ref=$6 WHERE id=$1",
        [
          claim.attempt.id,
          JSON.stringify(selection),
          delegated ? 'delegated' : 'base',
          runtime?.resourceKey ?? null,
          runtime?.fence ?? null,
          runtime?.operationRef ?? null,
        ],
      );
      if (descriptor) {
        await manager.query(
          'UPDATE nodia_ai_jobs SET recovery_descriptor=$2::jsonb WHERE id=$1',
          [claim.job.id, JSON.stringify(descriptor)],
        );
      }
      await armChatGeneration(manager,claim.attempt.id);
    });
  }
  async finish(
    claim: NodiaAiClaim,
    outcome: NodiaAiStageOutcome,
  ): Promise<void> {
    if (
      outcome.status === 'continue' &&
      (!/^[a-z][a-z0-9_]{0,127}$/.test(outcome.nextStage) ||
        outcome.nextStage === claim.job.stage_key)
    )
      throw new Error('nodia_ai_invalid_stage_transition');
    if (
      (outcome.status === 'failed' || outcome.status === 'unknown') &&
      !/^nodia_ai:[a-z0-9_]{1,100}$/.test(outcome.errorCode)
    )
      throw new Error('nodia_ai_invalid_error_code');
    await this.execute(claim, async (manager) => {
      const currentAttempt = await this.runtime.findAttempt(
        manager,
        claim.job.id,
        claim.attempt.id,
      );
      const terminalProof =
        'terminalProof' in outcome ? outcome.terminalProof : undefined;
      const rejectionProof =
        outcome.status === 'failed' ? outcome.rejectionProof : undefined;
      if (
        rejectionProof &&
        (terminalProof ||
          currentAttempt?.phase !== 'dispatch_armed' ||
          claim.run.selection_snapshot.mode !== 'agentic' ||
          rejectionProof.attemptId !== claim.attempt.id ||
          outcome.status !== 'failed' ||
          outcome.errorCode !== 'nodia_ai:runtime_busy' ||
          outcome.persist !== undefined)
      )
        throw Error('nodia_ai:invalid_dispatch_rejection');
      if (terminalProof && currentAttempt?.phase !== 'dispatch_armed')
        throw Error('nodia_ai:invalid_terminal_proof');
      if (currentAttempt?.phase === 'claimed' && outcome.status !== 'unknown') {
        await manager.query(
          "UPDATE nodia_ai_runtime_slots SET state='free',fence=fence+1,conversation_id=NULL,job_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,updated_at=clock_timestamp() WHERE job_id=$1 AND state='held' AND holder_worker_id=$2 AND external_operation_ref=$3",
          [claim.job.id, claim.attempt.worker_id, claim.attempt.id],
        );
      }
      if (
        outcome.status !== 'unknown' &&
        currentAttempt?.phase === 'dispatch_armed'
      ) {
        const job = await this.runtime.lockJob(manager, claim.job.id);
        if ((!terminalProof && !rejectionProof) || !job)
          throw Error('nodia_ai:terminal_proof_required');
        const request = readRuntimeProofRequest(job.recovery_descriptor);
        if (rejectionProof) {
          assertNativeDispatchRejection(
            request,
            rejectionProof,
            claim.run.context_manifest.configuration_generation,
          );
          const released: {
            resource_key: string;
          }[] = await manager.query(
            `WITH changed AS (UPDATE nodia_ai_runtime_slots SET state='free',fence=fence+1,conversation_id=NULL,job_id=NULL,holder_worker_id=NULL,lease_until=NULL,external_operation_ref=NULL,updated_at=clock_timestamp()
             WHERE resource_key=$1 AND state='held' AND job_id=$2 AND holder_worker_id=$3
               AND fence=$4 AND external_operation_ref=$5 AND lease_until>clock_timestamp() RETURNING resource_key) SELECT resource_key FROM changed`,
            [
              request.resourceKey,
              claim.job.id,
              claim.attempt.worker_id,
              currentAttempt.runtime_fence,
              request.operationRef,
            ],
          );
          if (released.length !== 1) throw new NodiaAiLostLeaseError();
          await manager.query(
            'UPDATE nodia_ai_jobs SET recovery_descriptor=$2::jsonb WHERE id=$1',
            [
              claim.job.id,
              JSON.stringify({
                ...job.recovery_descriptor,
                known_rejection: rejectionProof,
              }),
            ],
          );
        } else {
          assertRuntimeTerminalProof(request, terminalProof!);
          if (
            terminalProof!.attemptId !== claim.attempt.id ||
            (outcome.status === 'failed' &&
              terminalProof!.outcome !== 'completed')
          )
            throw Error('nodia_ai:invalid_terminal_proof');
        }
      }
      if ('persist' in outcome && outcome.persist)
        await outcome.persist(manager);
      if(terminalProof)await finishChatGeneration(manager,claim.attempt.id,terminalProof);
      if ('terminalProof' in outcome && outcome.terminalProof) {
        const proof = outcome.terminalProof;
        await manager.query(
          `INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key,recovery_descriptor)
          VALUES($1,'reconcile',$2,NULL,NULL,'waiting',clock_timestamp(),clock_timestamp()+$3*interval '1 second','reconcile_ack',$4::jsonb)
          ON CONFLICT(dedup_key) DO NOTHING`,
          [
            randomUUID(),
            'ack:' + claim.attempt.id,
            this.policy.retention.physical_cleanup_target_seconds,
            JSON.stringify(terminalRuntimeProofDescriptor(proof)),
          ],
        );
      }
      const state =
        outcome.status === 'continue'
          ? 'ready'
          : outcome.status === 'completed'
            ? 'done'
            : outcome.status === 'waiting'
              ? 'waiting'
              : outcome.status;
      const runState =
        outcome.status === 'continue'
          ? 'queued'
          : outcome.status === 'waiting'
            ? 'waiting_for_user'
            : outcome.status;
      const errorCode = 'errorCode' in outcome ? outcome.errorCode : null;
      await manager.query(
        'UPDATE nodia_ai_job_attempts SET phase=$2,error_code=$3,ended_at=clock_timestamp() WHERE id=$1',
        [
          claim.attempt.id,
          outcome.status === 'unknown'
            ? 'unknown'
            : outcome.status === 'failed'
              ? 'failed'
              : 'completed',
          errorCode,
        ],
      );
      await manager.query(
        'UPDATE nodia_ai_jobs SET state=$2,stage_key=$3,stage_seq=stage_seq+$4,available_at=clock_timestamp(),lease_owner=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1',
        [
          claim.job.id,
          state,
          outcome.status === 'continue'
            ? outcome.nextStage
            : claim.job.stage_key,
          outcome.status === 'continue' ? 1 : 0,
        ],
      );
      await manager.query(
        "UPDATE nodia_ai_runs SET state=$2,phase=$3,error_code=$4,completed_at=CASE WHEN $2 IN ('completed','failed','cancelled') THEN clock_timestamp() ELSE NULL END WHERE id=$1",
        [
          claim.run.id,
          runState,
          outcome.status === 'continue'
            ? outcome.nextStage
            : claim.job.stage_key,
          errorCode,
        ],
      );
      if (outcome.status !== 'continue' && outcome.status !== 'unknown')
        await manager.query(
          'UPDATE nodia_ai_conversations SET active_job_id=NULL,updated_at=clock_timestamp() WHERE id=$1 AND active_job_id=$2',
          [claim.job.conversation_id, claim.job.id],
        );
      if (outcome.status !== 'continue')
        await manager.query(
          'UPDATE nodia_ai_execution_grants SET revoked_at=clock_timestamp() WHERE run_id=$1 AND revoked_at IS NULL',
          [claim.run.id],
        );
      if (outcome.status === 'unknown')
        await manager.query(
          "UPDATE nodia_ai_runtime_slots SET state='unknown',updated_at=clock_timestamp() WHERE job_id=$1 AND state='held'",
          [claim.job.id],
        );
      await publishNodiaAiRunChanged(manager, {
        conversationId: claim.run.conversation_id,
        runId: claim.run.id,
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
    });
  }
}
