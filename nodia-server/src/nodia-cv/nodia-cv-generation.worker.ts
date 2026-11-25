import {
  Inject,
  Injectable,
  Optional,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { EntityManager } from 'typeorm';
import { ApiTextGenerationService } from '../ai-generation/api-text-generation.service.js';
import { agenticHash } from '../ai-generation/agentic-text-contract.js';
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
  CV_TAILORING_SCHEMA_VERSION,
  CvTailoringError,
  prepareCvTailoring,
  type CvTailoringDraft,
} from './engine/index.js';
import {
  CV_AGENTIC_CONTRACT,
  CV_AGENTIC_POLICY_VERSION,
  cvAgenticPayloadHash,
  parseCvAgenticReceipt,
  type CvAgenticDescriptor,
  type CvAgenticReceipt,
} from './agentic/nodia-cv-agentic-contract.js';
import {
  parseCvProviderDescriptor,
  parseCvProviderReceipt,
  type CvGeminiDescriptor,
  type CvGeminiReceipt,
  type CvProviderReceipt,
} from './agentic/nodia-cv-agentic-provider.js';
import { NodiaCvCodexTransport } from './agentic/nodia-cv-codex-transport.js';
import { NodiaCvGeminiTransport } from './agentic/nodia-cv-gemini-transport.js';
import { NodiaCvGenerationScope } from './nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from './nodia-cv-generation.store.js';
import { NodiaCvProfilesService } from './nodia-cv-profiles.service.js';
import {
  cvAgenticObservationBusy,
  NodiaCvSelectionService,
  type CvAgenticObservation,
} from './nodia-cv-selection.service.js';
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
  CvAgenticOperation,
  CvGenerationClaim,
  CvGenerationRow,
} from './types/nodia-cv-generation.types.js';

type Closure = {
  claim: CvGenerationClaim;
  draft: CvTailoringDraft | null;
  responseHash: string | null;
  error: string;
};

const GEMINI_STATUS_INTERVAL_MS = 500;
const GEMINI_RECOVERY_REQUEST_MS = 5_000;

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
    @Optional() private readonly codex?: NodiaCvCodexTransport,
    @Optional() private readonly gemini?: NodiaCvGeminiTransport,
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

  private async configuration(
    manager: EntityManager,
    row: CvGenerationRow,
    observation: CvAgenticObservation = null,
  ) {
    if (!row.selection_snapshot) cvGenerationError('selection_unavailable');
    const config =
      row.selection_snapshot.mode === 'agentic'
        ? await this.selections.configureAgentic(
            row.selection_snapshot,
            manager,
            observation,
          )
        : await this.selections.configure(row.selection_snapshot, manager);
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

  private async claim(workerId: string, signal: AbortSignal, onlyId?: string) {
    const next = await this.scope.transaction(async (manager) => {
      const row = await this.store.next(
        manager,
        this.policy.queue.foreground_workers,
        onlyId,
      );
      if (!row) return null;
      if (row.selection_snapshot?.mode !== 'agentic')
        return this.claimOwned(manager, row, workerId, null);
      try {
        await this.authorize(manager, row);
      } catch (error) {
        return this.rejectClaim(manager, row, error);
      }
      return { agentic: row.id, selection: row.selection_snapshot };
    }, true);
    if (!next || !('agentic' in next)) return next;

    const observation = await this.selections.observeAgentic(
      next.selection,
      signal,
    );
    if (signal.aborted || cvAgenticObservationBusy(observation)) return null;
    return this.scope.transaction(async (manager) => {
      const row = await this.store.next(
        manager,
        this.policy.queue.foreground_workers,
        next.agentic,
      );
      return row ? this.claimOwned(manager, row, workerId, observation) : null;
    }, true);
  }

  private async rejectClaim(
    manager: EntityManager,
    row: CvGenerationRow,
    error: unknown,
  ) {
    const failure =
      error instanceof CvTailoringError
        ? 'generation_invalid_input'
        : cvGenerationFailure(error);
    if (!failure) throw error;
    await this.store.fail(manager, row.id, 'failed', failure);
    return { claim: null };
  }

  private async claimOwned(
    manager: EntityManager,
    row: CvGenerationRow,
    workerId: string,
    observation: CvAgenticObservation,
  ) {
    try {
      await this.authorize(manager, row);
      const configuration = await this.configuration(manager, row, observation);
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
      const agenticDescriptor =
        configuration.keyId === null
          ? parseCvProviderDescriptor({
              contract: CV_AGENTIC_CONTRACT,
              owner_kind: 'cv',
              provider: configuration.providerKey,
              mode: row.selection_snapshot.mode,
              generation_id: row.id,
              attempt_id: randomUUID(),
              actor_id: row.owner_user_id,
              profile_id: row.profile_id,
              profile_revision: row.profile_revision,
              payload_hash: cvAgenticPayloadHash(prepared),
              resource_key: configuration.resourceKey,
              configuration_generation: configuration.configurationGeneration,
              session_generation: configuration.sessionGeneration,
              connection_id: configuration.connectionId,
              model_id: row.selection_snapshot.model_id,
              effort_id: row.selection_snapshot.effort_id,
              purpose_version: CV_TAILORING_PURPOSE,
              prompt_version: CV_TAILORING_PROMPT_VERSION,
              schema_version: CV_TAILORING_SCHEMA_VERSION,
              policy_version: CV_AGENTIC_POLICY_VERSION,
              policy_hash: configuration.policyHash,
              runtime_hash: configuration.runtimeHash,
            })
          : undefined;
      const claim = await this.store.hold(
        manager,
        {
          row,
          prepared,
          selection: row.selection_snapshot,
          configuration,
          workerId,
          executionHash,
          agenticDescriptor,
        },
        this.policy,
      );
      return claim ? { claim, observation } : null;
    } catch (error) {
      return this.rejectClaim(manager, row, error);
    }
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
    const next = await this.claim(workerId, signal, onlyId);
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

    if (claim.agenticDescriptor) {
      try {
        await this.executeAgentic(
          claim,
          'observation' in next ? next.observation : null,
          leaseSignal,
        );
        return true;
      } finally {
        clearInterval(timer);
        await check;
      }
    }

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

  private async executeAgentic(
    claim: CvGenerationClaim,
    observation: CvAgenticObservation,
    signal: AbortSignal,
  ) {
    const descriptor = claim.agenticDescriptor;
    if (!descriptor) cvGenerationError('agentic_transport_unavailable', 503);
    try {
      if (descriptor.provider === 'gemini') {
        await this.executeGemini(claim, observation, descriptor, signal);
      } else {
        await this.executeCodex(claim, observation, descriptor, signal);
      }
    } catch {
      // Admission, terminal commit, release or ACK may already have happened. Reconcile
      // the existing operation after its lease, never start another native exchange.
    }
  }

  private async executeCodex(
    claim: CvGenerationClaim,
    observation: CvAgenticObservation,
    descriptor: CvAgenticDescriptor,
    signal: AbortSignal,
  ) {
    const codex = this.codex;
    if (!codex) cvGenerationError('agentic_transport_unavailable', 503);
    const result = await codex.execute(
      {
        descriptor,
        prepared: claim.prepared,
        deadlineAt: claim.deadlineAt,
        signal,
      },
      {
        bind: (custody, active) =>
          this.scope.transaction(async (manager) => {
            const op = await this.store.owned(manager, claim);
            if (!op?.valid_lease) return false;
            await this.authorize(manager, claim.row);
            await this.configuration(manager, claim.row, observation);
            active.throwIfAborted();
            return this.store.agenticBind(manager, op, descriptor, custody);
          }, true),
        arm: async ({ owner, native, workspace }, active) => {
          const custody = { owner, native, workspace };
          const captured = await this.scope.transaction(async (manager) => {
            const op = await this.store.owned(manager, claim);
            return op
              ? this.store.agenticCapture(manager, op, descriptor, custody)
              : false;
          }, true);
          if (!captured) return false;
          return this.scope.transaction(async (manager) => {
            const op = await this.store.owned(manager, claim);
            if (!op?.valid_lease) return false;
            await this.authorize(manager, claim.row);
            await this.configuration(manager, claim.row, observation);
            active.throwIfAborted();
            return this.store.agenticArm(manager, op, descriptor, custody);
          }, true);
        },
        terminal: (outcome) =>
          this.finishAgentic(
            claim,
            observation,
            outcome.state === 'draft' ? outcome.draft : null,
            outcome.receipt,
          ),
      },
    );
    await this.scope.transaction(async (manager) => {
      const op = await this.store.owned(manager, claim);
      if (op) await this.store.agenticAcknowledge(manager, op, result.receipt);
    }, true);
  }

  private async executeGemini(
    claim: CvGenerationClaim,
    observation: CvAgenticObservation,
    descriptor: CvGeminiDescriptor,
    signal: AbortSignal,
  ) {
    const gemini = this.gemini;
    if (!gemini) cvGenerationError('agentic_transport_unavailable', 503);
    let command: ReturnType<NodiaCvGeminiTransport['prepare']>;
    try {
      command = gemini.prepare(descriptor, claim.prepared, claim.deadlineAt);
    } catch (error) {
      if (!(error instanceof CvTailoringError)) throw error;
      const receipt = this.geminiUndispatched(descriptor);
      await this.finishAgentic(
        claim,
        observation,
        null,
        receipt,
        null,
        'generation_invalid_input',
      );
      await this.acknowledgeGemini(claim, null, receipt);
      return;
    }
    const requestHash = command.request_hash;
    const armed = await this.scope.transaction(async (manager) => {
      const op = await this.store.owned(manager, claim);
      if (!op?.valid_lease) return false;
      await this.authorize(manager, claim.row);
      await this.configuration(manager, claim.row, observation);
      signal.throwIfAborted();
      return this.store.geminiArm(manager, op, descriptor, requestHash);
    }, true);
    if (!armed) return;

    let receipt: CvGeminiReceipt;
    let draft: CvTailoringDraft | null = null;
    if (signal.aborted) {
      receipt = this.geminiUndispatched(descriptor);
    } else {
      let snapshot = await gemini.start(command, descriptor, signal);
      while (snapshot.state === 'running') {
        await delay(GEMINI_STATUS_INTERVAL_MS, undefined, { signal });
        snapshot = await gemini.status(descriptor, requestHash, signal);
      }
      receipt = snapshot.receipt;
      if (snapshot.text !== null && receipt.remote_outcome === 'completed') {
        parseCvProviderReceipt(receipt, descriptor, snapshot.text);
        try {
          draft = buildCvDraft(claim.prepared, snapshot.text);
        } catch (error) {
          if (!(error instanceof CvTailoringError)) throw error;
        }
      }
    }
    await this.finishAgentic(claim, observation, draft, receipt, requestHash);
    if (receipt.remote_outcome !== 'not_dispatched')
      await gemini.acknowledge(
        descriptor,
        requestHash,
        receipt,
        AbortSignal.timeout(GEMINI_RECOVERY_REQUEST_MS),
      );
    await this.acknowledgeGemini(claim, requestHash, receipt);
  }

  private acknowledgeGemini(
    claim: CvGenerationClaim,
    requestHash: string | null,
    receipt: CvGeminiReceipt,
  ) {
    return this.scope.transaction(async (manager) => {
      const op = await this.store.owned(manager, claim);
      if (op?.cv_gemini_request_hash === requestHash)
        await this.store.agenticAcknowledge(manager, op, receipt);
    }, true);
  }

  private geminiUndispatched(descriptor: CvGeminiDescriptor): CvGeminiReceipt {
    return {
      ...descriptor,
      terminal_proof_id: randomUUID(),
      process_closed: true,
      remote_outcome: 'not_dispatched',
      response_hash: null,
      observed_at: new Date().toISOString(),
    };
  }

  private finishAgentic(
    claim: CvGenerationClaim,
    observation: CvAgenticObservation,
    draft: CvTailoringDraft | null,
    candidate: CvProviderReceipt,
    nativeRequestHash: string | null = null,
    beforeDispatchFailure = 'provider_unavailable',
  ) {
    return this.scope.transaction(async (manager) => {
      const op = await this.store.owned(manager, claim);
      if (!op) cvGenerationError('generation_lease_lost');
      if (
        !op.agentic_transport_descriptor ||
        (op.cv_gemini_request_hash ?? null) !== nativeRequestHash
      )
        cvGenerationError('generation_lease_lost');
      const receipt = parseCvProviderReceipt(
        candidate,
        op.agentic_transport_descriptor,
      );
      if (op.phase === 'closed') {
        await this.store.agenticTerminal(manager, op, receipt);
        return;
      }
      let failure =
        receipt.remote_outcome === 'not_dispatched'
          ? beforeDispatchFailure
          : 'generation_invalid_output';
      let mayPublish =
        Boolean(draft) &&
        receipt.remote_outcome === 'completed' &&
        op.started_exchanges === 1 &&
        op.valid_lease;
      if (mayPublish && draft) {
        mayPublish =
          Buffer.byteLength(JSON.stringify(draft)) <= 250 * 1024 &&
          (!claim.row.qualification || validCvProbeDraft(draft));
      } else if (draft && !op.valid_lease) failure = 'generation_lease_lost';
      if (op.valid_lease) {
        try {
          await this.authorize(manager, claim.row);
          await this.configuration(manager, claim.row, observation);
        } catch (error) {
          const reason = cvGenerationFailure(error);
          if (!reason) throw error;
          failure = reason;
          mayPublish = false;
        }
      }
      if (mayPublish && draft && receipt.response_hash) {
        await this.store.publish(
          manager,
          claim.row,
          draft,
          receipt.response_hash,
        );
      } else {
        const remoteUnknown = receipt.remote_outcome === 'unknown';
        await this.store.fail(
          manager,
          op.id,
          remoteUnknown ? 'unknown' : 'failed',
          remoteUnknown ? 'provider_outcome_unknown' : failure,
        );
      }
      await this.store.agenticTerminal(manager, op, receipt);
    }, true);
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

  private sameAgenticOperation(
    current: CvAgenticOperation,
    expected: CvAgenticOperation,
  ) {
    return (
      current.id === expected.id &&
      current.runtime_fence === expected.runtime_fence &&
      current.request_hash === expected.request_hash &&
      current.started_exchanges === expected.started_exchanges &&
      current.cv_gemini_request_hash === expected.cv_gemini_request_hash &&
      agenticHash(current.agentic_transport_descriptor) ===
        agenticHash(expected.agentic_transport_descriptor) &&
      agenticHash(current.cv_agentic_native) ===
        agenticHash(expected.cv_agentic_native)
    );
  }

  private async recoverCodex(
    codex: NodiaCvCodexTransport,
    candidate: CvAgenticOperation,
    descriptor: CvAgenticDescriptor,
  ) {
    let receipt: CvAgenticReceipt | null = candidate.terminal_proof
      ? parseCvAgenticReceipt(candidate.terminal_proof, descriptor)
      : null;
    if (!receipt) {
      const closed = await codex
        .provenClosed(descriptor, candidate.cv_agentic_native)
        .catch(() => false);
      receipt = await this.scope.transaction(async (manager) => {
        const [current] = await this.store.pendingAgenticOperations(
          manager,
          candidate.id,
        );
        if (!current || !this.sameAgenticOperation(current, candidate))
          return null;
        if (current.terminal_proof)
          return parseCvAgenticReceipt(current.terminal_proof, descriptor);
        if (!closed) {
          await this.store.markAgenticUnproven(manager, current);
          return null;
        }
        const started = current.started_exchanges > 0;
        const terminal = parseCvAgenticReceipt(
          {
            ...descriptor,
            terminal_proof_id: randomUUID(),
            process_closed: true,
            remote_outcome: started ? 'unknown' : 'not_dispatched',
            response_hash: null,
            observed_at: new Date().toISOString(),
          },
          descriptor,
        );
        await this.store.fail(
          manager,
          current.id,
          started ? 'unknown' : 'failed',
          started
            ? 'provider_outcome_unknown'
            : 'generation_worker_lost_before_dispatch',
        );
        await this.store.agenticTerminal(manager, current, terminal);
        return terminal;
      }, true);
    }
    if (!receipt) return;
    const terminal = receipt;
    // The terminal is durable. Profile release is idempotent and uses the exact
    // custody record; no provider call takes place on this path.
    try {
      await codex.releaseClosed(descriptor, candidate.cv_agentic_native);
    } catch {
      return;
    }
    await this.scope.transaction(async (manager) => {
      const [current] = await this.store.pendingAgenticOperations(
        manager,
        candidate.id,
      );
      if (current && this.sameAgenticOperation(current, candidate))
        await this.store.agenticAcknowledge(manager, current, terminal);
    }, true);
  }

  private async recoverGemini(
    gemini: NodiaCvGeminiTransport,
    candidate: CvAgenticOperation,
    descriptor: CvGeminiDescriptor,
  ) {
    const requestHash = candidate.cv_gemini_request_hash;
    let receipt = candidate.terminal_proof
      ? parseCvProviderReceipt(candidate.terminal_proof, descriptor)
      : null;
    if (!receipt) {
      let nativeReceipt: CvGeminiReceipt | null = null;
      if (requestHash === null && candidate.started_exchanges === 0) {
        nativeReceipt = this.geminiUndispatched(descriptor);
      } else if (requestHash !== null) {
        const snapshot = await gemini
          .reconcile(
            descriptor,
            requestHash,
            AbortSignal.timeout(GEMINI_RECOVERY_REQUEST_MS),
          )
          .catch(() => null);
        if (snapshot?.state === 'terminal') nativeReceipt = snapshot.receipt;
      }

      receipt = await this.scope.transaction(async (manager) => {
        const [current] = await this.store.pendingAgenticOperations(
          manager,
          candidate.id,
        );
        if (!current || !this.sameAgenticOperation(current, candidate))
          return null;
        if (current.terminal_proof)
          return parseCvProviderReceipt(current.terminal_proof, descriptor);
        if (!nativeReceipt) {
          await this.store.markAgenticUnproven(manager, current);
          return null;
        }
        // The original authority to publish is gone. Keep the native receipt,
        // discard generated text and retire the intent without replay.
        const unknown = nativeReceipt.remote_outcome === 'unknown';
        await this.store.fail(
          manager,
          current.id,
          unknown ? 'unknown' : 'failed',
          unknown
            ? 'provider_outcome_unknown'
            : current.started_exchanges === 0
              ? 'generation_worker_lost_before_dispatch'
              : 'generation_lease_lost',
        );
        await this.store.agenticTerminal(manager, current, nativeReceipt);
        return nativeReceipt;
      }, true);
    }
    if (!receipt || receipt.provider !== 'gemini') return;
    if (receipt.remote_outcome !== 'not_dispatched') {
      if (requestHash === null) return;
      try {
        await gemini.acknowledge(
          descriptor,
          requestHash,
          receipt,
          AbortSignal.timeout(GEMINI_RECOVERY_REQUEST_MS),
        );
      } catch {
        return;
      }
    }
    const terminal = receipt;
    await this.scope.transaction(async (manager) => {
      const [current] = await this.store.pendingAgenticOperations(
        manager,
        candidate.id,
      );
      if (current && this.sameAgenticOperation(current, candidate))
        await this.store.agenticAcknowledge(manager, current, terminal);
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
    if (this.codex || this.gemini) {
      const pending = await this.scope.transaction((manager) =>
        this.store.pendingAgenticOperations(manager),
      );
      for (const op of pending) {
        try {
          const descriptor = parseCvProviderDescriptor(
            op.agentic_transport_descriptor,
          );
          if (descriptor.provider === 'openai' && this.codex)
            await this.recoverCodex(this.codex, op, descriptor);
          if (descriptor.provider === 'gemini' && this.gemini)
            await this.recoverGemini(this.gemini, op, descriptor);
        } catch (error) {
          failure ??= error;
        }
      }
    }
    if (failure) throw failure;
  }
}
