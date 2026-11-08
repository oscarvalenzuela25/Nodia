import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodiaAiAdapterError } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { ClaimNodiaAiJobUseCase } from './claim-nodia-ai-job.use-case.js';
import { CheckpointNodiaAiJobUseCase } from './checkpoint-nodia-ai-job.use-case.js';
import { RetryNodiaAiJobUseCase } from './retry-nodia-ai-job.use-case.js';
import { nodiaAiFailureDiagnostic } from '../types/nodia-ai-failure-diagnostic.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';
import {
  NODIA_AI_STAGE_HANDLER,
  NodiaAiKnownPreDispatchError,
  NodiaAiLostLeaseError,
  type NodiaAiStageHandler,
  type NodiaAiStageOutcome,
} from '../types/worker.types.js';

@Injectable()
export class RunNodiaAiStageUseCase {
  private readonly logger = new Logger(RunNodiaAiStageUseCase.name);
  constructor(
    private readonly claim: ClaimNodiaAiJobUseCase,
    private readonly checkpoint: CheckpointNodiaAiJobUseCase,
    private readonly retry: RetryNodiaAiJobUseCase,
    @Inject(NODIA_AI_STAGE_HANDLER)
    private readonly handler: NodiaAiStageHandler,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(workerId: string, stopSignal: AbortSignal): Promise<boolean> {
    if (stopSignal.aborted) return false;
    const claim = await this.claim.execute(
      workerId,
      this.handler.catalogVersions,
    );
    if (!claim) return false;
    let dispatched = false;
    let lostLease = false;
    let heartbeat: Promise<void> | undefined;
    const local = new AbortController();
    const signal = AbortSignal.any([stopSignal, local.signal]);
    const claimedAt = Date.now();
    const claimedMonotonic = performance.now();
    const absoluteDeadline = Math.min(
      claim.job.deadline_at.getTime(),
      claim.run.deadline_at.getTime(),
    );
    const claimedRemaining = absoluteDeadline - claimedAt;
    const remaining = () => Math.min(
      absoluteDeadline - Date.now(),
      claimedRemaining - (performance.now() - claimedMonotonic),
    );
    const duration = Math.max(
      1,
      Math.min(
        this.policy.timing.provider_dispatch_seconds * 1000,
        remaining(),
      ),
    );
    const preparationExpired = () => remaining() <= 0 ||
      Date.now() - claimedAt >= duration ||
      performance.now() - claimedMonotonic >= duration;
    let deadline = setTimeout(
      () => local.abort(new Error('nodia_ai:deadline_exceeded')),
      duration,
    );
    let dispatchDeadline: number | undefined;
    let dispatchMonotonic = 0;
    let dispatchDuration = 0;
    const abortExpiredWindow = () => {
      if (dispatchDeadline === undefined ? preparationExpired() :
        remaining() <= 0 || Date.now() >= dispatchDeadline ||
        performance.now() - dispatchMonotonic >= dispatchDuration)
        local.abort(new Error('nodia_ai:deadline_exceeded'));
    };
    const timer = setInterval(() => {
      if (heartbeat) return;
      heartbeat = this.checkpoint
        .heartbeat(claim)
        .catch(() => {
          lostLease = true;
          local.abort(new NodiaAiLostLeaseError());
        })
        .finally(() => {
          heartbeat = undefined;
        });
    }, this.policy.timing.heartbeat_seconds * 1000);
    timer.unref();
    deadline.unref();
    const operation = Promise.resolve().then(() =>
      this.handler.execute(claim, {
        signal,
        armDispatch: async (selection, runtime, validate) => {
          if (signal.aborted || lostLease) throw new NodiaAiLostLeaseError();
          if (dispatchDeadline === undefined && preparationExpired()) {
            const failure = new NodiaAiKnownPreDispatchError('nodia_ai:deadline_exceeded');
            local.abort(failure);
            throw failure;
          }
          // A pending SQL commit may have armed dispatch even if its response is lost.
          const previouslyDispatched = dispatched;
          dispatched = true;
          let validationError: NodiaAiKnownPreDispatchError | undefined;
          try {
            await this.checkpoint.armDispatch(
              claim,
              selection,
              runtime,
              validate
                ? async (manager) => {
                    try {
                      await validate(manager);
                    } catch (error: unknown) {
                      if (error instanceof NodiaAiKnownPreDispatchError)
                        validationError = error;
                      throw error;
                    }
                  }
                : undefined,
              (error) => { validationError = error; },
            );
          } catch (error: unknown) {
            // Only this exact trusted local rejection proves this arming did not occur.
            if (validationError !== undefined && error === validationError)
              dispatched = previouslyDispatched;
            throw error;
          }
          // Do not resume an external dispatch after cancellation won the race.
          if (signal.aborted || lostLease) throw new NodiaAiLostLeaseError();
          if (dispatchDeadline === undefined) {
            // A microtask can finish the commit before an overdue timer callback runs.
            if (preparationExpired()) {
              local.abort(new Error('nodia_ai:deadline_exceeded'));
              throw new NodiaAiLostLeaseError();
            }
            dispatchDuration = Math.min(
              this.policy.timing.provider_dispatch_seconds * 1000,
              remaining(),
            );
            if (dispatchDuration <= 0) {
              local.abort(new Error('nodia_ai:deadline_exceeded'));
              throw new NodiaAiLostLeaseError();
            }
            dispatchDeadline = Math.min(absoluteDeadline, Date.now() + dispatchDuration);
            dispatchMonotonic = performance.now();
            // Preparation (including the arming commit) has its own bounded window.
            // Only a successful first commit starts the provider's single window.
            clearTimeout(deadline);
            deadline = setTimeout(
              () => local.abort(new Error('nodia_ai:deadline_exceeded')),
              dispatchDuration,
            );
            deadline.unref();
          }
          return new Date(dispatchDeadline);
        },
        checkpoint: (work, isolation) => {
          abortExpiredWindow();
          if (signal.aborted || lostLease)
            return Promise.reject(new NodiaAiLostLeaseError());
          return this.checkpoint.execute(
            claim,
            async (manager) => {
              abortExpiredWindow();
              if (signal.aborted || lostLease)
                throw new NodiaAiLostLeaseError();
              return work(manager);
            },
            isolation,
          );
        },
      }),
    );
    // Observe late settlement even if an uncooperative adapter ignores AbortSignal.
    const observed = operation.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<{ error: unknown }>((resolve) => {
      onAbort = () =>
        resolve({ error: signal.reason ?? new Error('nodia_ai:cancelled') });
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const settled = await Promise.race([observed, aborted]);
      if ('error' in settled) {
        try {
          this.logger.warn(
            'nodia_ai_stage_execution_failed ' +
              JSON.stringify({
                phase: 'handler',
                dispatched,
                signal_aborted: signal.aborted,
                lost_lease: lostLease,
                ...nodiaAiFailureDiagnostic(settled.error),
              }),
          );
        } catch {
          /* Supplemental logging cannot change recovery or retry behavior. */
        }
      }
      if (lostLease) return true;
      let outcome: NodiaAiStageOutcome;
      if ('error' in settled) {
        const error = settled.error;
        if (
          !dispatched &&
          error instanceof NodiaAiKnownPreDispatchError &&
          error.retryable &&
          (await this.retry.execute(claim, error.errorCode))
        )
          return true;
        outcome = error instanceof NodiaAiAdapterError && error.outcome === 'not_dispatched' && error.rejectionProof
          ? { status: 'failed', errorCode: 'nodia_ai:runtime_busy', rejectionProof: error.rejectionProof }
          : {
          status: dispatched ? 'unknown' : 'failed',
          errorCode: dispatched
            ? 'nodia_ai:outcome_unknown'
            : error instanceof NodiaAiKnownPreDispatchError
              ? error.errorCode
              : signal.aborted
                ? 'nodia_ai:cancelled'
                : 'nodia_ai:stage_failed',
        };
      } else outcome = settled.value;
      // A handler cannot downgrade a potentially sent operation without the private terminal receipt.
      // The checkpoint validates every proof field before committing any known failure or cleanup.
      if (dispatched && outcome.status === 'failed' && !outcome.terminalProof && !outcome.rejectionProof)
        outcome = { status: 'unknown', errorCode: 'nodia_ai:outcome_unknown' };
      await this.checkpoint.finish(claim, outcome);
      return true;
    } catch (error: unknown) {
      if (!(error instanceof NodiaAiLostLeaseError)) {
        try {
          this.logger.warn(
            'nodia_ai_stage_checkpoint_unavailable ' +
              JSON.stringify({
                phase: 'checkpoint',
                dispatched,
                signal_aborted: signal.aborted,
                lost_lease: lostLease,
                ...nodiaAiFailureDiagnostic(error),
              }),
          );
        } catch {
          /* Logging is supplemental to durable recovery. */
        }
      }
      // Durable lease/phase recovery owns reconciliation after a failed commit.
      return true;
    } finally {
      clearTimeout(deadline);
      clearInterval(timer);
      if (onAbort) signal.removeEventListener('abort', onAbort);
      await heartbeat;
    }
  }
}
