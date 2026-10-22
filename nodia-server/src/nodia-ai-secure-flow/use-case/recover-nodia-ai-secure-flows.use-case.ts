import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiExecutionService } from '../../nodia-ai-execution/nodia-ai-execution.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  ManageAiProviderSecureSessionUseCase,
  type AiProviderSecureReference,
  type AiProviderSecureRequest,
} from '../../ai-provider/use-case/manage-ai-provider-secure-session.use-case.js';
import { NodiaAiExecution } from '../../nodia-ai-confirmation/entities/nodia-ai-execution.entity.js';
import { NodiaAiExecutionStep } from '../../nodia-ai-confirmation/entities/nodia-ai-execution-step.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiExecutionGrant } from '../../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import { nodiaAiSecureOperationIdentity } from '../../nodia-ai-proposal/types/secure-operation.types.js';
import {
  secureDescriptor,
  secureFlowReceipt,
} from '../types/secure-flow.types.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import {
  acknowledgeSecureFlow,
  secureFlowAcknowledgement,
  terminalSecureStates,
  type SecureFlowAcknowledgement,
} from '../acknowledge-secure-flow.js';

/** Only cancels an owned login job or records its existing terminal witness. Never starts a new effect. */
@Injectable()
export class RecoverNodiaAiSecureFlowsUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly native: ManageAiProviderSecureSessionUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(): Promise<number> {
    const deadline =
      Date.now() + this.policy.timing.cancellation_seconds * 1000;
    let remoteCleanupUsed = false;
    const candidates = await this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      return manager.query(
        `SELECT e.id AS execution_id FROM nodia_ai_jobs j JOIN nodia_ai_executions e ON
          (e.id=j.execution_id OR (j.execution_id IS NULL AND j.recovery_descriptor->>'execution_id'=e.id::text))
        WHERE j.kind='execution'
        AND NOT COALESCE(j.recovery_descriptor ? 'restore_quarantined',false)
        AND EXISTS(SELECT 1 FROM nodia_ai_execution_steps s WHERE s.execution_id=e.id AND s.recovery_descriptor->>'kind'='secure_human_flow'
          AND ((j.state IN ('waiting','unknown') AND e.state IN ('waiting_for_user','unknown'))
            OR (s.recovery_descriptor->>'status' IN ('completed','cancelled','expired','failed')
              AND s.recovery_descriptor->'native_request' IS NOT NULL AND s.recovery_descriptor->'native_request'<>'null'::jsonb)))
        ORDER BY j.updated_at,j.id LIMIT $1`,
        [this.policy.queue.waiting_global],
      ) as Promise<{ execution_id: string }[]>;
    });
    let count = 0;
    for (const candidate of candidates) {
      // Do not rotate rows whose native cleanup cannot be attempted in this pass.
      // Rotating the whole list after spending the budget preserves its old order
      // and lets an unresolved first row starve every later request indefinitely.
      if (Date.now() >= deadline || remoteCleanupUsed) break;
      const prepared = await this.store.transaction(async (manager) => {
        await lockAuthority(
          manager,
          false,
          this.policy.timing.read_query_seconds * 1000,
        );
        await lockNodiaAiQueue(manager);
        const state = await this.load(manager, candidate.execution_id);
        if (!state) return null;
        // Rotate inspected rows, including unresolved ones, so they cannot starve later waits.
        state.job.updated_at = state.now;
        await manager.getRepository(NodiaAiJob).save(state.job);
        const acknowledgement = secureFlowAcknowledgement(
          state.execution.id,
          state.execution.revision,
          state.descriptor,
        );
        if (acknowledgement) return { done: 'ack' as const, acknowledgement };
        let revoked = false;
        try {
          await this.authorize.execute(
            {
              userId: state.descriptor.actor_id,
              sessionId: state.descriptor.session_id,
            },
            state.descriptor.flow_kind === 'nodia_logout'
              ? {}
              : {
                  moduleRoutes: ['/settings/ai-providers'],
                  actionKeys: ['ai:manage'],
                },
            manager,
          );
        } catch (error) {
          if (
            error instanceof ForbiddenException ||
            error instanceof UnauthorizedException
          )
            revoked = true;
          else throw error;
        }
        const active =
          !revoked &&
          state.chat?.lifecycle === 'active' &&
          state.chat.expires_at > state.now &&
          state.job.deadline_at > state.now &&
          state.grant &&
          !state.grant.revoked_at &&
          state.grant.expires_at > state.now &&
          state.now < new Date(state.descriptor.expires_at);
        const canObserve =
          !!state.descriptor.native_request &&
          ['invoking', 'unknown'].includes(state.descriptor.status);
        if (active && !canObserve) return null;
        if (
          state.descriptor.status === 'waiting' &&
          state.descriptor.native_reference === null &&
          state.descriptor.request_id === null
        ) {
          await this.finish(manager, state, 'expired');
          return { done: 'finished' as const };
        }
        if (
          !active &&
          (state.descriptor.status !== 'unknown' ||
            state.execution.state !== 'unknown' ||
            state.job.state !== 'unknown')
        ) {
          state.descriptor.status = 'unknown';
          state.step.recovery_descriptor = state.descriptor;
          state.execution.state = 'unknown';
          state.execution.revision++;
          state.job.state = 'unknown';
          state.job.updated_at = state.now;
          await manager.getRepository(NodiaAiExecutionStep).save(state.step);
          await manager.getRepository(NodiaAiExecution).save(state.execution);
          await manager.getRepository(NodiaAiJob).save(state.job);
        }
        // Missing start response is not proof of cancellation. Keep the minimal witness quarantined.
        return {
          done: 'observe' as const,
          reference: state.descriptor.reference,
          requestId: state.descriptor.request_id,
          ref: state.descriptor.native_reference,
          nativeRequest: state.descriptor.native_request ?? null,
          actor: state.descriptor.actor_id,
          revision: state.execution.revision,
          operation: active ? ('observe' as const) : ('cancel' as const),
        };
      });
      if (!prepared) continue;
      if (prepared.done === 'ack') {
        if (!remoteCleanupUsed && Date.now() < deadline) {
          remoteCleanupUsed = true;
          if (
            await acknowledgeSecureFlow(
              this.store,
              this.native,
              prepared.acknowledgement,
            )
          )
            count++;
        }
        continue;
      }
      if (prepared.done === 'finished') {
        count++;
        continue;
      }
      if (
        (!prepared.ref && !prepared.nativeRequest) ||
        remoteCleanupUsed ||
        Date.now() >= deadline
      )
        continue;
      // One finite native transport timeout per maintenance pass; no N * remote timeout fan-out.
      remoteCleanupUsed = true;
      try {
        const observation = prepared.nativeRequest
          ? await (prepared.operation === 'observe'
              ? this.native.observeRequest(
                  prepared.nativeRequest as AiProviderSecureRequest,
                  prepared.actor,
                )
              : this.native.cancelRequest(
                  prepared.nativeRequest as AiProviderSecureRequest,
                  prepared.actor,
                ))
          : await this.native.cleanup(
              prepared.ref as unknown as AiProviderSecureReference,
              prepared.actor,
            );
        if (!observation) continue;
        if (observation.state === 'pending' && prepared.operation === 'cancel')
          continue;
        let acknowledgement: SecureFlowAcknowledgement | null = null;
        const finished = await this.store.transaction(async (manager) => {
          await lockAuthority(
            manager,
            false,
            this.policy.timing.read_query_seconds * 1000,
          );
          await lockNodiaAiQueue(manager);
          const current = await this.load(manager, candidate.execution_id);
          if (
            !current ||
            current.descriptor.reference !== prepared.reference ||
            current.descriptor.request_id !== prepared.requestId ||
            current.execution.revision !== prepared.revision ||
            (prepared.operation === 'cancel' &&
              current.descriptor.status !== 'unknown') ||
            (prepared.operation === 'observe' &&
              !['invoking', 'unknown'].includes(current.descriptor.status))
          )
            return false;
          current.descriptor.native_reference =
            observation.reference as unknown as NodiaAiExecutionStep['minimal_scope'];
          secureDescriptor(current.descriptor);
          if (observation.state === 'pending') {
            current.descriptor.status = 'pending';
            current.step.recovery_descriptor = current.descriptor;
            current.step.state = 'waiting_for_user';
            current.execution.state = 'waiting_for_user';
            current.execution.revision++;
            current.job.state = 'waiting';
            current.job.updated_at = current.now;
            await manager
              .getRepository(NodiaAiExecutionStep)
              .save(current.step);
            await manager
              .getRepository(NodiaAiExecution)
              .save(current.execution);
            await manager.getRepository(NodiaAiJob).save(current.job);
            if (current.chat)
              await appendNodiaAiExecutionEvent(manager, {
                conversationId: current.chat.id,
                executionId: current.execution.id,
                eventKey: `execution:${current.execution.id}:${current.execution.revision}:waiting_for_user`,
                payload: {
                  revision: current.execution.revision,
                  state: 'waiting_for_user',
                  error: null,
                },
                moduleRoutes: current.grant?.allowed_modules ?? [],
                maxEvents: this.policy.results.outbox_events_per_activity,
              });
            return true;
          }
          await this.finish(
            manager,
            current,
            observation.state === 'completed'
              ? 'completed'
              : observation.state === 'failed'
                ? 'failed'
                : prepared.operation === 'observe' &&
                    observation.state === 'cancelled'
                  ? 'cancelled'
                  : 'expired',
          );
          acknowledgement = secureFlowAcknowledgement(
            current.execution.id,
            current.execution.revision,
            current.descriptor,
          );
          return true;
        });
        if (finished)
          await acknowledgeSecureFlow(this.store, this.native, acknowledgement);
        if (finished) count++;
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
      }
    }
    return count;
  }
  private async load(manager: EntityManager, id: string) {
    const initial = await this.store.execution(manager, id);
    if (!initial) return null;
    const chat = initial.conversation_id
      ? await this.store.chat(manager, initial.conversation_id)
      : null;
    let jobs = await this.store.jobs(manager, id);
    if (jobs.length === 0) {
      const detached: { id: string }[] = await manager.query(
        `SELECT id FROM nodia_ai_jobs WHERE kind='execution' AND execution_id IS NULL AND state='unknown'
        AND recovery_descriptor->>'execution_id'=$1 ORDER BY id LIMIT 2 FOR UPDATE`,
        [id],
      );
      if (detached.length === 1) {
        const job = await manager.getRepository(NodiaAiJob).findOne({
          where: { id: detached[0].id },
          lock: { mode: 'pessimistic_write' },
        });
        if (job) jobs = [job];
      }
    }
    const execution = await this.store.execution(manager, id, true),
      steps = await this.store.steps(manager, id),
      grants = await this.store.grants(manager, id);
    const job = jobs[0],
      step = steps[0];
    if (
      !execution ||
      jobs.length !== 1 ||
      steps.length !== 1 ||
      !job ||
      job.recovery_descriptor?.restore_quarantined !== undefined ||
      !step ||
      !nodiaAiSecureOperationIdentity(step.tool_name) ||
      ![
        'waiting_for_user',
        'unknown',
        'completed',
        'cancelled',
        'failed',
      ].includes(execution.state) ||
      !['waiting', 'unknown', 'done', 'cancelled', 'failed'].includes(job.state)
    )
      return null;
    const descriptor = secureDescriptor(step.recovery_descriptor);
    const terminal = terminalSecureStates.includes(descriptor.status);
    if (
      terminal
        ? !descriptor.native_request
        : step.state === 'completed' || step.minimal_receipt !== null
    )
      return null;
    if (
      descriptor.actor_id !== execution.actor_id ||
      (descriptor.native_request &&
        descriptor.native_request.request_id !== step.native_request_key) ||
      descriptor.flow_kind !==
        nodiaAiSecureOperationIdentity(step.tool_name)?.kind
    )
      return null;
    return {
      chat,
      job,
      execution,
      step,
      grant: grants[0],
      descriptor,
      now: await this.store.now(manager),
    };
  }
  private async finish(
    manager: EntityManager,
    state: NonNullable<
      Awaited<ReturnType<RecoverNodiaAiSecureFlowsUseCase['load']>>
    >,
    outcome: 'expired' | 'failed' | 'completed' | 'cancelled',
  ) {
    if (!state.chat && !state.descriptor.native_request) {
      // Detached jobs must stay unknown until deletion; their CHECK forbids a false done/failed target.
      await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [
        state.job.id,
      ]);
      await manager.query('DELETE FROM nodia_ai_executions WHERE id=$1', [
        state.execution.id,
      ]);
      return;
    }
    const completed = outcome === 'completed',
      now = await this.store.now(manager);
    state.descriptor.status = outcome;
    state.step.recovery_descriptor = state.descriptor;
    state.step.state = completed
      ? 'completed'
      : outcome === 'cancelled'
        ? 'cancelled'
        : 'failed';
    state.step.minimal_receipt = completed
      ? secureFlowReceipt(state.descriptor)
      : null;
    state.step.dispatched_at = completed ? now : null;
    state.step.completed_at = completed ? now : null;
    state.execution.state = completed
      ? 'completed'
      : outcome === 'cancelled'
        ? 'cancelled'
        : 'failed';
    state.execution.revision++;
    state.execution.completed_at = completed ? now : null;
    state.job.state = !state.chat
      ? 'unknown'
      : completed
        ? 'done'
        : outcome === 'cancelled'
          ? 'cancelled'
          : 'failed';
    state.job.lease_owner = null;
    state.job.lease_until = null;
    state.job.updated_at = now;
    await manager.getRepository(NodiaAiExecutionStep).save(state.step);
    await manager.getRepository(NodiaAiExecution).save(state.execution);
    await manager.getRepository(NodiaAiJob).save(state.job);
    if (state.grant) {
      state.grant.revoked_at = now;
      await manager.getRepository(NodiaAiExecutionGrant).save(state.grant);
    }
    if (state.chat) {
      await manager.query(
        'UPDATE nodia_ai_conversations SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',
        [state.chat.id, state.job.id],
      );
      await appendNodiaAiExecutionEvent(manager, {
        conversationId: state.chat.id,
        executionId: state.execution.id,
        eventKey: `execution:${state.execution.id}:${state.execution.revision}:${state.execution.state}`,
        payload: {
          revision: state.execution.revision,
          state: state.execution.state,
          error: null,
        },
        moduleRoutes: state.grant?.allowed_modules ?? [],
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
    }
  }
}
