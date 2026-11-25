import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiTextGenerationService } from '../ai-generation/api-text-generation.service.js';
import {
  GenerationWorkerSourceRegistry,
  type GenerationWorkerSource,
} from '../ai-generation/worker-source-registry.js';
import { isApiExecutorProvenClosed } from '../nodia-ai-adapter/api-nodia-ai-runtime-owner.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';
import {
  buildCvDraft,
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CvTailoringError,
  prepareCvTailoring,
  type CvTailoringDraft,
} from './engine/index.js';
import { NodiaCvGenerationScope } from './nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from './nodia-cv-generation.store.js';
import { NodiaCvProfilesService } from './nodia-cv-profiles.service.js';
import { NodiaCvSelectionService } from './nodia-cv-selection.service.js';
import {
  cvGenerationError,
  cvGenerationFailure,
} from './policies/nodia-cv-generation-errors.js';
import {
  cvExecutionHash,
  cvGenerationPrompt,
  cvResponseHash,
  validCvProbeDraft,
} from './policies/nodia-cv-generation.js';
import type {
  CvGenerationClaim,
  CvGenerationRow,
} from './types/nodia-cv-generation.types.js';

type Closure = {
  claim: CvGenerationClaim;
  draft: CvTailoringDraft | null;
  responseHash: string | null;
  error: string;
};

@Injectable()
export class NodiaCvGenerationWorker
  implements OnModuleInit, GenerationWorkerSource
{
  // These entries have returned from the local HTTP transport; recovery only flushes their receipt.
  private readonly closedLocally = new Map<string, Closure>();

  constructor(
    private readonly scope: NodiaCvGenerationScope,
    private readonly store: NodiaCvGenerationStore,
    private readonly profiles: NodiaCvProfilesService,
    private readonly selections: NodiaCvSelectionService,
    private readonly api: ApiTextGenerationService,
    private readonly registry: GenerationWorkerSourceRegistry,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  onModuleInit() {
    this.registry.register(this, 'cv');
  }

  private async authorize(manager: EntityManager, row: CvGenerationRow) {
    const actor = await this.scope.authorize(manager, {
      userId: row.owner_user_id,
      sessionId: row.auth_session_public_id ?? '',
    });
    if (row.qualification && !actor.isSuperAdmin)
      cvGenerationError('authority_changed', 403);
    if (!row.profile_id) cvGenerationError('profile_not_found', 404);
    const profile = await this.profiles.find(
      manager,
      row.profile_id,
      row.owner_user_id,
      'read',
    );
    if (!profile) cvGenerationError('profile_not_found', 404);
    if (profile.revision !== row.profile_revision)
      cvGenerationError('stale_profile');
  }

  private async configuration(manager: EntityManager, row: CvGenerationRow) {
    if (!row.selection_snapshot || row.selection_snapshot.mode !== 'api_key')
      cvGenerationError('selection_unavailable');
    const config = await this.selections.configure(
      row.selection_snapshot,
      manager,
    );
    if (
      config.resourceKey !== row.resource_key ||
      config.configurationGeneration !== row.configuration_generation ||
      config.sessionGeneration !== row.session_generation ||
      this.selections.scopeHash(row.selection_snapshot, config) !==
        row.scope_hash
    )
      cvGenerationError('generation_configuration_changed');
    if (
      !row.qualification &&
      !(await this.selections.qualified(manager, row.scope_hash))
    )
      cvGenerationError('generation_selection_unqualified');
    return config;
  }

  private claim(workerId: string, onlyId?: string) {
    return this.scope.transaction(async (manager) => {
      const row = await this.store.next(
        manager,
        this.policy.queue.foreground_workers,
        onlyId,
      );
      if (!row) return null;
      try {
        await this.authorize(manager, row);
        const configuration = await this.configuration(manager, row);
        if (
          row.prompt_version !== CV_TAILORING_PROMPT_VERSION ||
          row.purpose_version !== CV_TAILORING_PURPOSE ||
          !row.selection_snapshot ||
          !row.profile_snapshot ||
          !row.offer_text ||
          !row.request_hash
        )
          cvGenerationError('generation_input_changed');

        const prepared = prepareCvTailoring({
          profile: row.profile_snapshot,
          offer: row.offer_text,
          locale: row.language,
        });
        const executionHash = cvExecutionHash(
          row.request_hash,
          row.scope_hash,
          cvGenerationPrompt(prepared),
        );
        const claim = await this.store.hold(
          manager,
          {
            row,
            prepared,
            selection: row.selection_snapshot,
            configuration,
            workerId,
            executionHash,
          },
          this.policy,
        );
        return claim ? { claim } : null;
      } catch (error) {
        const failure =
          error instanceof CvTailoringError
            ? 'generation_invalid_input'
            : cvGenerationFailure(error);
        if (!failure) throw error;
        await this.store.fail(manager, row.id, 'failed', failure);
        return { claim: null };
      }
    }, true);
  }

  private beforeExchange(claim: CvGenerationClaim) {
    return this.scope.transaction(async (manager) => {
      const owned = await this.store.owned(manager, claim);
      if (
        !owned?.valid_lease ||
        owned.phase !== 'dispatch_armed' ||
        owned.started_exchanges !== 0
      )
        cvGenerationError('generation_lease_lost');
      await this.authorize(manager, claim.row);
      await this.configuration(manager, claim.row);
      await this.store.beforeExchange(manager, claim.row.id);
    }, true);
  }

  private heartbeat(claim: CvGenerationClaim) {
    return this.scope.transaction(async (manager) => {
      if (!(await this.store.owned(manager, claim))?.valid_lease)
        cvGenerationError('generation_lease_lost');
      await this.authorize(manager, claim.row);
      await this.store.renew(
        manager,
        claim.row.id,
        this.policy.timing.lease_seconds,
      );
    }, true);
  }

  async execute(
    workerId: string,
    signal: AbortSignal,
    onlyId?: string,
  ): Promise<boolean> {
    if (signal.aborted) return false;
    const next = await this.claim(workerId, onlyId);
    if (!next) return false;
    const { claim } = next;
    if (!claim) return true;

    const stop = new AbortController();
    const leaseSignal = AbortSignal.any([
      signal,
      stop.signal,
      AbortSignal.timeout(Math.max(1, claim.deadlineAt.getTime() - Date.now())),
    ]);
    let check: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (!check)
        check = this.heartbeat(claim)
          .catch((error) => stop.abort(error))
          .finally(() => {
            check = undefined;
          });
    }, this.policy.timing.heartbeat_seconds * 1000).unref();

    let draft: CvTailoringDraft | null = null;
    let responseHash: string | null = null;
    let error = 'provider_unavailable';
    try {
      const result = await this.api.execute(
        {
          operationId: claim.row.id,
          selection: claim.selection,
          resourceKey: claim.row.resource_key,
          configurationGeneration: claim.row.configuration_generation,
          sessionGeneration: claim.row.session_generation,
          deadlineAt: claim.deadlineAt,
          prompt: cvGenerationPrompt(claim.prepared),
          beforeExchange: () => this.beforeExchange(claim),
          checkLease: () => this.heartbeat(claim),
        },
        leaseSignal,
      );
      const digest = cvResponseHash(result.text);
      if (
        result.localClosed === true &&
        result.remoteOutcome === 'completed' &&
        result.responseHash === digest
      ) {
        responseHash = digest;
        const validated = buildCvDraft(claim.prepared, result.text);
        if (
          Buffer.byteLength(JSON.stringify(validated)) <= 250 * 1024 &&
          (!claim.row.qualification || validCvProbeDraft(validated))
        )
          draft = validated;
      }
      if (!draft) error = 'generation_invalid_output';
    } catch (cause) {
      error =
        cause instanceof CvTailoringError
          ? 'generation_invalid_output'
          : (cvGenerationFailure(cause) ?? 'provider_unavailable');
    } finally {
      clearInterval(timer);
      await check;
    }

    const closure = { claim, draft, responseHash, error };
    this.closedLocally.set(claim.row.id, closure);
    await this.finish(closure);
    this.closedLocally.delete(claim.row.id);
    return true;
  }

  private finish({ claim, draft, responseHash, error }: Closure) {
    return this.scope.transaction(async (manager) => {
      const op = await this.store.owned(manager, claim);
      if (!op) return;
      let mayPublish = Boolean(
        op.started_exchanges && op.valid_lease && responseHash && draft,
      );
      let reason = error;
      if (mayPublish) {
        try {
          await this.authorize(manager, claim.row);
          await this.configuration(manager, claim.row);
        } catch (cause) {
          const failure = cvGenerationFailure(cause);
          if (!failure) throw cause;
          reason = failure;
          mayPublish = false;
        }
      } else if (responseHash && draft && !op.valid_lease)
        reason = 'generation_lease_lost';

      if (mayPublish && draft && responseHash) {
        await this.store.publish(manager, claim.row, draft, responseHash);
      } else {
        const unknown = op.started_exchanges > 0 && !responseHash;
        await this.store.fail(
          manager,
          claim.row.id,
          unknown ? 'unknown' : 'failed',
          unknown ? 'provider_outcome_unknown' : reason,
        );
      }
      await this.store.close(
        manager,
        op,
        'same_executor_return',
        op.started_exchanges ? responseHash : null,
      );
    }, true);
  }

  async recover(): Promise<void> {
    let failure: unknown;
    for (const [id, closure] of this.closedLocally) {
      try {
        await this.finish(closure);
        this.closedLocally.delete(id);
      } catch (error) {
        failure ??= error;
      }
    }
    await this.scope.transaction(async (manager) => {
      await this.store.expire(manager);
      for (const op of await this.store.expiredOperations(manager)) {
        const beforeDispatch = op.started_exchanges === 0;
        if (
          !beforeDispatch &&
          (!op.api_owner_identity ||
            !isApiExecutorProvenClosed(op.api_owner_identity))
        ) {
          await this.store.markUnproven(manager, op);
          continue;
        }
        await this.store.fail(
          manager,
          op.id,
          beforeDispatch ? 'failed' : 'unknown',
          beforeDispatch
            ? 'generation_worker_lost_before_dispatch'
            : 'provider_outcome_unknown',
        );
        await this.store.close(
          manager,
          op,
          beforeDispatch
            ? 'durable_before_dispatch'
            : 'proven_dead_local_owner',
          null,
        );
      }
    }, true);
    if (failure) throw failure;
  }
}
