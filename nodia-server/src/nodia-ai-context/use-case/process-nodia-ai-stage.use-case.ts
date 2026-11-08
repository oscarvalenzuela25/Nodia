import { moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import { ProcessNodiaAiInvoiceOcrStageUseCase } from '../../nodia-ai-invoice-ocr/use-case/process-nodia-ai-invoice-ocr-stage.use-case.js';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { NodiaAiPreferenceReaderUseCase } from '../../nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case.js';
import { preferenceFingerprint } from '../../nodia-ai-preference/types/preference.types.js';
import { createHash, randomUUID } from 'node:crypto';
import { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import type { NodiaAiAttachmentKind } from '../../nodia-ai-attachment/types/attachment-ports.js';
import type { EntityManager } from 'typeorm';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  NodiaAiAdapterError,
  NodiaAiAdapterPort,
  supportsNodiaAiTools,
  isNodiaAiNativeFormatVerified,
  NODIA_AI_NATIVE_MEDIA_TYPES,
  type NodiaAiAdapterObservation,
  type NodiaAiContextMeasureInput,
  type NodiaAiContextMeasurement,
} from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  NodiaAiKnownPreDispatchError,
  NodiaAiLostLeaseError,
  type NodiaAiClaim,
  type NodiaAiRuntimeReservation,
  type NodiaAiStageContext,
  type NodiaAiStageHandler,
  type NodiaAiStageOutcome,
} from '../../nodia-ai-runtime/types/worker.types.js';
import { LoadNodiaAiKnowledgeUseCase } from './load-nodia-ai-knowledge.use-case.js';
import {
  BuildNodiaAiContextUseCase,
  type ContextHistoryItem,
} from './build-nodia-ai-context.use-case.js';
import { ReserveNodiaAiRuntimeSlotUseCase } from '../../nodia-ai-runtime/use-case/reserve-nodia-ai-runtime-slot.use-case.js';
import { ReleaseNodiaAiRuntimeSlotUseCase } from '../../nodia-ai-runtime/use-case/release-nodia-ai-runtime-slot.use-case.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { ExecuteNodiaAiToolUseCase } from '../../nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js';
import { appendNodiaAiEvent } from '../../nodia-ai-run/event-journal.js';
import { NodiaAiContextSnapshotService } from '../../nodia-ai-context-snapshot/nodia-ai-context-snapshot.service.js';
import { LoadNodiaAiContextHistoryUseCase } from '../../nodia-ai-context-snapshot/use-case/load-nodia-ai-context-history.use-case.js';
import {
  BuildNodiaAiCompactionUseCase,
  type NodiaAiCompactionResponseTransport,
} from './build-nodia-ai-compaction.use-case.js';
import { LoadNodiaAiRecoveryRefsUseCase } from './load-nodia-ai-recovery-refs.use-case.js';
import {
  NODIA_AI_COMPACTION_BUILDER_VERSION,
  isNodiaAiCompactionSummary,
  type NodiaAiCompactionSnapshot,
} from '../types/nodia-ai-compaction.types.js';
import { isDeepStrictEqual } from 'node:util';
import {
  AttestNodiaAiNativeSourcesUseCase,
  type NodiaAiNativeSourceInput,
} from './attest-nodia-ai-native-sources.use-case.js';
import {
  NodiaAiToolSelectionFlowUseCase,
  nodiaAiToolSelectionState,
} from '../../nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';
import { CleanupNodiaAiRuntimeProofsUseCase } from '../../nodia-ai-runtime/use-case/cleanup-nodia-ai-runtime-proofs.use-case.js';
import { NodiaAiJobAttempt } from '../../nodia-ai-runtime/entities/nodia-ai-job-attempt.entity.js';
import {
  bindObservationReservation,
  observationMatchesManifest,
} from './nodia-ai-observation-identity.js';
import { withNodiaAiEligibilityDiagnostic } from '../../nodia-ai-runtime/types/nodia-ai-failure-diagnostic.js';
import { invoiceOcrReferenceIds } from '../../nodia-ai-invoice-ocr/invoice-ocr-delivery.js';
import { NODIA_AI_INVOICE_OCR_TOOL } from '../../nodia-ai-invoice-ocr/types/invoice-ocr-port.js';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { imageGenerationCommand } from '../types/image-generation-command.js';
import { StoreNodiaAiGeneratedImageUseCase } from '../../nodia-ai-attachment/use-case/store-nodia-ai-generated-image.use-case.js';
const COMPACTION_RESPONSE_TRANSPORTS = {
  gemini_live_session_and_catalog: 'gemini_answer_envelope',
  codex_live_session_and_catalog: 'plain_text',
  api_configuration_and_catalog: 'plain_text',
} as const satisfies Readonly<
  Record<
    NodiaAiAdapterObservation['source'],
    NodiaAiCompactionResponseTransport
  >
>;
/** Conversation stages expose only the ToolGateway's published, authorized contracts. */
@Injectable()
export class ProcessNodiaAiStageUseCase implements NodiaAiStageHandler {
  readonly catalogVersions: readonly string[];
  constructor(
    private readonly knowledge: LoadNodiaAiKnowledgeUseCase,
    private readonly build: BuildNodiaAiContextUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly adapter: NodiaAiAdapterPort,
    private readonly reserve: ReserveNodiaAiRuntimeSlotUseCase,
    private readonly release: ReleaseNodiaAiRuntimeSlotUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly tools: ExecuteNodiaAiToolUseCase,
    private readonly preferences: NodiaAiPreferenceReaderUseCase,
    private readonly snapshots: NodiaAiContextSnapshotService,
    private readonly historyReader: LoadNodiaAiContextHistoryUseCase,
    private readonly compaction: BuildNodiaAiCompactionUseCase,
    private readonly recovery: LoadNodiaAiRecoveryRefsUseCase,
    private readonly toolSelection: NodiaAiToolSelectionFlowUseCase,
    private readonly cleanupProofs: CleanupNodiaAiRuntimeProofsUseCase,
    private readonly attachments?: ManageNodiaAiAttachmentUseCase,
    @Optional()
    private readonly invoiceOcr?: ProcessNodiaAiInvoiceOcrStageUseCase,
    @Optional()
    private readonly generatedImages?: StoreNodiaAiGeneratedImageUseCase,
  ) {
    this.catalogVersions = Object.freeze([knowledge.manifest.catalog_release]);
  }
  async execute(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
  ): Promise<NodiaAiStageOutcome> {
    if (
      ![
        'context',
        'inference',
        'delegated_inference',
        'tool_selection',
        'invoice_ocr',
      ].includes(claim.job.stage_key)
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:unsupported_stage');
    if (
      claim.run.context_manifest.knowledge_release !==
      this.knowledge.manifest.release_id
    )
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:knowledge_release_changed',
      );
    if (claim.job.stage_key === 'delegated_inference')
      throw new NodiaAiKnownPreDispatchError('nodia_ai:mode_retired');
    if (
      claim.run.routing_snapshot.enabled ||
      claim.run.routing_snapshot.target !== null
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:mode_retired');
    if (claim.job.stage_key === 'invoice_ocr') {
      if (!this.invoiceOcr)
        throw new NodiaAiKnownPreDispatchError('nodia_ai:mode_unavailable');
      return this.invoiceOcr.execute(claim, context);
    }
    if (claim.job.stage_key === 'tool_selection')
      return this.activateTools(claim, context);
    const selection = claim.run.selection_snapshot;
    const data = await context.checkpoint((manager) =>
      this.history(manager, claim),
    );
    let imageGeneration:
      | {
          prompt: string;
        }
      | undefined;
    try {
      imageGeneration = imageGenerationCommand(
        data.history,
        claim.run.input_through_seq,
      );
    } catch {
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:invalid_image_generation_request',
      );
    }
    if (imageGeneration && !this.generatedImages)
      throw new NodiaAiKnownPreDispatchError('nodia_ai:mode_unavailable');
    let assembled:
      ReturnType<BuildNodiaAiContextUseCase['execute']> | undefined;
    let assemblyError: unknown = data.complete
      ? undefined
      : new Error('nodia_ai:context_limit');
    try {
      if (data.complete)
        assembled = this.build.execute({
          moduleRoutes: data.routes,
          history: data.history,
          throughSeq: claim.run.input_through_seq,
          mode: selection.mode,
          routingEnabled: Boolean(claim.run.routing_snapshot?.enabled),
          acceptedPreferences: data.preferences,
          snapshot: data.snapshot,
          recoveryRefs: data.recoveryRefs,
          toolSelection: claim.run.context_manifest.tool_selection,
          capabilityIndex: data.capabilityIndex,
          invoiceOcrReferenceIds: invoiceOcrReferenceIds(
            claim.run.context_manifest,
          ),
        });
    } catch (error: unknown) {
      assemblyError = error;
    }
    const prefix = data.history.filter(
      (item) => BigInt(item.seq) < BigInt(claim.run.input_through_seq),
    );
    const nativeRefs = data.history
      .filter((item) => item.seq === claim.run.input_through_seq)
      .flatMap((item) =>
        item.parts.filter(
          (part) =>
            part.kind !== 'text' &&
            part.text === null &&
            !invoiceOcrReferenceIds(claim.run.context_manifest).includes(
              part.attachment_id!,
            ),
        ),
      );
    // Pure adapter measurement includes protocol/catalog overhead and performs no inference.
    const contextBudget =
      assembled && claim.job.stage_key === 'context'
        ? await this.measure(
            {
              selection,
              canonicalPrompt: assembled.prompt,
              tools: await this.tools.descriptors(claim, context),
              ...(nativeRefs.length
                ? {
                    attachments: nativeRefs.map((part) => ({
                      kind: part.kind as NodiaAiAttachmentKind,
                    })),
                  }
                : {}),
            },
            context.signal,
          )
        : undefined;
    const oversized =
      !assembled ||
      Boolean(contextBudget && this.exceedsContextBudget(contextBudget)) ||
      Buffer.byteLength(JSON.stringify(data.history), 'utf8') >=
        this.policy.results.assembled_context_utf8_bytes / 2;
    if (
      claim.job.stage_key === 'context' &&
      prefix.length &&
      oversized &&
      (!assemblyError ||
        (assemblyError instanceof Error &&
          assemblyError.message === 'nodia_ai:context_limit'))
    )
      return this.compact(claim, context, selection, data, prefix);
    if (!assembled) {
      const error = assemblyError;
      const code =
        error instanceof Error && /^nodia_ai:[a-z_]+$/.test(error.message)
          ? error.message
          : 'nodia_ai:context_invalid';
      throw new NodiaAiKnownPreDispatchError(code);
    }
    if (contextBudget && this.exceedsContextBudget(contextBudget))
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit');
    const readyContext = assembled;
    if (claim.job.stage_key === 'context')
      return {
        status: 'continue',
        nextStage: 'inference',
        persist: async (manager) => {
          await this.checkSources(manager, claim, data);
          const run = await manager
            .getRepository(NodiaAiRun)
            .findOneByOrFail({ id: claim.run.id });
          run.context_manifest = {
            ...run.context_manifest,
            ...readyContext.manifest,
            ...(contextBudget
              ? { native_context_budget: { ...contextBudget } }
              : {}),
          };
          run.context_snapshot_id = data.snapshot?.id ?? null;
          await manager.getRepository(NodiaAiRun).save(run);
        },
      };
    const observation = await this.observeBeforeDispatch(
      selection,
      context.signal,
    );
    this.rejectRetryableObservationTimeout(
      claim,
      selection,
      observation,
      context.signal,
    );
    if (
      !observation.available ||
      !observation.resourceKey ||
      !observationMatchesManifest(
        selection,
        observation,
        claim.run.context_manifest,
      ) ||
      observation.configurationGeneration !==
        claim.run.context_manifest.configuration_generation ||
      observation.sessionGeneration !==
        claim.run.context_manifest.session_generation ||
      observation.resourceKey !== claim.run.context_manifest.resource_key
    )
      throw withNodiaAiEligibilityDiagnostic(
        new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed'),
        () => ({
          location: 'inference_observation_guard',
          reason: observation.reason,
          source: observation.source,
          adapter_contract: observation.adapterContractVersion,
          selection_phase: nodiaAiToolSelectionState(
            claim.run.context_manifest.tool_selection,
          )?.phase,
          available: observation.available,
          delegated: false,
          resource_key_present:
            typeof observation.resourceKey === 'string' &&
            observation.resourceKey.length > 0,
          resource_key_matches:
            observation.resourceKey === claim.run.context_manifest.resource_key,
          configuration_matches:
            observation.configurationGeneration ===
            claim.run.context_manifest.configuration_generation,
          session_matches:
            observation.sessionGeneration ===
            claim.run.context_manifest.session_generation,
          adapter_identity_matches: observationMatchesManifest(
            selection,
            observation,
            claim.run.context_manifest,
          ),
          supports_mcp: observation.supportsMcp,
        }),
      );
    if (
      imageGeneration &&
      selection.mode === 'api_key' &&
      observation.supportsImageGeneration !== true
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:modality_unavailable');
    if (
      nativeRefs.length &&
      (!this.attachments ||
        nativeRefs.some(
          (part) =>
            !observation.verifiedAttachmentMediaTypes?.some((mime) =>
              isNodiaAiNativeFormatVerified(
                observation.verifiedAttachmentMediaTypes,
                part.kind,
                mime,
              ),
            ),
        ))
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:modality_unavailable');
    // Private storage I/O stays outside SQL and before arming an inference. content() rechecks current authority after reading.
    const nativeAttachments = [];
    const nativeSourceInputs: NodiaAiNativeSourceInput[] = [];
    for (const ref of nativeRefs) {
      const file = await this.attachments!.content(
        claim.identity,
        ref.attachment_id!,
        context.signal,
      );
      if (
        !Object.hasOwn(NODIA_AI_NATIVE_MEDIA_TYPES, file.media_type) ||
        !isNodiaAiNativeFormatVerified(
          observation.verifiedAttachmentMediaTypes,
          ref.kind,
          file.media_type,
        )
      )
        throw new NodiaAiKnownPreDispatchError('nodia_ai:modality_unavailable');
      const contentHash = createHash('sha256')
        .update(file.buffer)
        .digest('hex');
      nativeAttachments.push({
        kind: ref.kind as NodiaAiAttachmentKind,
        media_type: file.media_type,
        sha256: contentHash,
        content_base64: file.buffer.toString('base64'),
      });
      nativeSourceInputs.push({
        attachment_id: ref.attachment_id!,
        kind: ref.kind as NodiaAiAttachmentKind,
        media_type: file.media_type,
        content_hash: contentHash,
        byte_count: file.buffer.byteLength,
      });
    }
    const tools =
      !imageGeneration && supportsNodiaAiTools(observation)
        ? await this.tools.descriptors(claim, context)
        : [];
    const nativeBudget = await this.measure(
      {
        selection,
        canonicalPrompt: readyContext.prompt,
        tools,
        ...(nativeAttachments.length
          ? {
              attachments: nativeAttachments.map(({ kind, media_type }) => ({
                kind,
                media_type,
              })),
            }
          : {}),
      },
      context.signal,
    );
    if (this.exceedsContextBudget(nativeBudget))
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit');
    await context.checkpoint(async (manager) => {
      await this.checkSources(manager, claim, data);
      await this.adapter.verifyConfiguration(
        selection,
        observation.configurationGeneration,
        manager,
      );
      await this.checkRouting(manager, claim, false);
      const run = await manager
        .getRepository(NodiaAiRun)
        .findOneByOrFail({ id: claim.run.id });
      const previous = run.context_manifest.stage_contexts;
      const analysisSources = tools.some(
        (tool) => tool.name === 'nodia_invoices_analyze',
      )
        ? await new AttestNodiaAiNativeSourcesUseCase().execute(
            manager,
            run,
            nativeSourceInputs,
          )
        : undefined;
      const contexts =
        previous && typeof previous === 'object' && !Array.isArray(previous)
          ? previous
          : {};
      if (
        Object.keys(contexts).length >=
        this.policy.results.json_collection_items
      )
        throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit');
      run.context_manifest = {
        ...run.context_manifest,
        stage_contexts: {
          ...contexts,
          [claim.attempt.id]: {
            ...(analysisSources
              ? {
                  user_message_id: run.user_message_id,
                  input_through_seq: run.input_through_seq,
                  invoice_analysis_sources: analysisSources,
                }
              : {}),
            context_sha256: readyContext.manifest.context_sha256,
            context_bytes: readyContext.manifest.context_bytes,
            through_seq: claim.run.input_through_seq,
            accepted_preferences: readyContext.manifest.accepted_preferences,
            native_context_budget: { ...nativeBudget },
            ...(readyContext.manifest.context_snapshot
              ? { context_snapshot: readyContext.manifest.context_snapshot }
              : {}),
          },
        },
      };
      await manager.getRepository(NodiaAiRun).save(run);
    });
    const reservation = await this.reserve.execute(
      claim,
      observation.resourceKey,
      claim.attempt.id,
    );
    const boundReservation = bindObservationReservation(
      selection,
      observation,
      reservation,
      claim.attempt.id,
    );
    const dispatchDeadline = await context.armDispatch(
      selection,
      boundReservation,
      async (manager) => {
        await this.checkRouting(manager, claim, false);
        await this.checkSources(manager, claim, data);
      },
    );
    const response = await this.adapter.execute(
      {
        attemptId: claim.attempt.id,
        selection,
        canonicalPrompt: readyContext.prompt,
        ...(imageGeneration ? { imageGeneration } : {}),
        deadlineAt: dispatchDeadline,
        resourceKey: observation.resourceKey,
        configurationGeneration: observation.configurationGeneration,
        sessionGeneration: observation.sessionGeneration,
        ...(boundReservation.adapterIdentity
          ? {
              onLeaseCheck: (signal: AbortSignal) =>
                this.assertRuntimeLease(
                  claim,
                  context,
                  boundReservation,
                  signal,
                ),
            }
          : {}),
        ...(nativeAttachments.length ? { attachments: nativeAttachments } : {}),
        ...(!imageGeneration && supportsNodiaAiTools(observation)
          ? {
              tools,
              onToolCall: async (
                call: {
                  callId: string;
                  name: string;
                  arguments: unknown;
                },
                signal: AbortSignal,
              ) => {
                if (signal.aborted) throw new Error('nodia_ai:cancelled');
                return this.tools.execute(claim, context, call);
              },
            }
          : {}),
        ...(['agentic', 'api_key'].includes(selection.mode)
          ? {
              onProtocolProgress: (
                total: number,
                signal: AbortSignal,
                unforwarded = 0,
              ) =>
                this.protocolProgress(
                  claim,
                  context,
                  total,
                  signal,
                  unforwarded,
                ),
            }
          : {}),
      },
      context.signal,
    );
    // A discovery receipt grants no business authority inside this generation. Seal its
    // exact provider proof first; a non-inference stage will acknowledge it before activation.
    if (!response.terminalProof)
      return {
        status: 'unknown',
        errorCode: 'nodia_ai:invalid_provider_response',
      };
    const initialToolSelection = nodiaAiToolSelectionState(
      claim.run.context_manifest.tool_selection,
    );
    const requested =
      supportsNodiaAiTools(observation) &&
      initialToolSelection &&
      ['discovery', 'selection_requested'].includes(initialToolSelection.phase)
        ? await context.checkpoint(async (manager) => {
            const run = await manager
              .getRepository(NodiaAiRun)
              .findOneByOrFail({ id: claim.run.id });
            const state = nodiaAiToolSelectionState(
              run.context_manifest.tool_selection,
            );
            return state?.phase === 'selection_requested' &&
              state.request?.attempt_id === claim.attempt.id
              ? state
              : undefined;
          })
        : undefined;
    if (requested && response.terminalProof.outcome !== 'completed')
      return {
        status: 'unknown',
        errorCode: 'nodia_ai:invalid_provider_response',
      };
    if (
      requested &&
      supportsNodiaAiTools(observation) &&
      response.kind === 'answer'
    ) {
      return {
        status: 'continue',
        nextStage: 'tool_selection',
        terminalProof: response.terminalProof,
        persist: async (manager) => {
          await this.release.execute(
            claim,
            reservation,
            response.terminalProof,
            manager,
          );
          const run = await manager
            .getRepository(NodiaAiRun)
            .findOneByOrFail({ id: claim.run.id });
          const current = nodiaAiToolSelectionState(
            run.context_manifest.tool_selection,
          );
          if (!current || !isDeepStrictEqual(current, requested))
            throw new Error('nodia_ai:tool_selection_changed');
          run.context_manifest = {
            ...run.context_manifest,
            tool_selection: {
              ...current,
              phase: 'ack_pending',
            } as unknown as NodiaAiClaim['run']['context_manifest'],
          };
          await manager.getRepository(NodiaAiRun).save(run);
        },
      };
    }
    const invoiceOcrRequest = this.invoiceOcr
      ? await this.invoiceOcr.pending(claim, context)
      : null;
    if (invoiceOcrRequest) {
      if (
        response.kind !== 'answer' ||
        response.terminalProof.outcome !== 'completed'
      )
        return {
          status: 'unknown',
          errorCode: 'nodia_ai:invalid_provider_response',
        };
      return {
        status: 'continue',
        nextStage: 'invoice_ocr',
        terminalProof: response.terminalProof,
        persist: async (manager) => {
          await this.release.execute(
            claim,
            reservation,
            response.terminalProof,
            manager,
          );
          const run = await manager
            .getRepository(NodiaAiRun)
            .findOneByOrFail({ id: claim.run.id });
          run.context_manifest = {
            ...run.context_manifest,
            invoice_ocr_request: invoiceOcrRequest,
          };
          await manager.getRepository(NodiaAiRun).save(run);
        },
      };
    }
    if (response.kind !== 'answer')
      return {
        status: 'failed',
        errorCode: 'nodia_ai:invalid_provider_response',
        terminalProof: response.terminalProof,
        persist: (manager) =>
          this.release.execute(
            claim,
            reservation,
            response.terminalProof,
            manager,
          ),
      };
    // Typed terminal reply proves the adapter finished this operation; no replay is needed to seal it.
    if (
      Boolean(response.kind === 'answer' && response.generatedImage) !==
      Boolean(imageGeneration)
    ) {
      // A closed native turn with an invalid/missing image fails without generating again.
      if (
        imageGeneration ||
        (response.kind === 'answer' && response.generatedImage)
      )
        return {
          status: 'failed',
          errorCode: 'nodia_ai:invalid_generated_image',
          terminalProof: response.terminalProof,
          persist: (manager) =>
            this.release.execute(
              claim,
              reservation,
              response.terminalProof,
              manager,
            ),
        };
    }
    const text = response.text;
    if (
      (!text.trim() &&
        !(response.kind === 'answer' && response.generatedImage)) ||
      Buffer.byteLength(text, 'utf8') >
        this.policy.results.assistant_text_utf8_bytes
    )
      return {
        status: 'unknown',
        errorCode: 'nodia_ai:invalid_provider_response',
      };
    // Object-store I/O stays outside SQL. Until sealing, the output remains a
    // quota-accounted attachment owned by this chat and its retention lifecycle.
    let generated:
      | Awaited<ReturnType<StoreNodiaAiGeneratedImageUseCase['execute']>>
      | undefined;
    try {
      if (response.kind === 'answer' && response.generatedImage)
        generated = await this.generatedImages!.execute(
          claim.identity,
          claim.run.conversation_id,
          claim.run.id,
          response.generatedImage,
        );
    } catch {
      return {
        status: 'failed',
        errorCode: 'nodia_ai:generated_image_storage_unavailable',
        terminalProof: response.terminalProof,
        persist: (manager) =>
          this.release.execute(
            claim,
            reservation,
            response.terminalProof,
            manager,
          ),
      };
    }
    return {
      status: 'completed',
      terminalProof: response.terminalProof,
      persist: async (manager) => {
        const bytes = Buffer.byteLength(text, 'utf8');
        const storage: {
          chat_bytes: string;
          owner_bytes: string;
        } = this.attachments
          ? await this.attachments.usageForAdmission(
              manager,
              claim.run.conversation_id,
              claim.identity.userId,
              new Date(),
              claim.run.id,
            )
          : (
              await manager.query(
                `SELECT
        COALESCE(sum(octet_length(p.text)) FILTER (WHERE c.id=$1),0)::text AS chat_bytes,
        COALESCE(sum(octet_length(p.text)),0)::text AS owner_bytes
        FROM nodia_ai_conversations c JOIN nodia_ai_message_parts p ON p.conversation_id=c.id
        WHERE c.owner_id=$2`,
                [claim.run.conversation_id, claim.identity.userId],
              )
            )[0];
        if (
          BigInt(storage.chat_bytes) + BigInt(bytes) >
            BigInt(this.policy.admission.chat_storage_bytes) ||
          BigInt(storage.owner_bytes) + BigInt(bytes) >
            BigInt(this.policy.admission.owner_storage_bytes)
        )
          throw new Error('nodia_ai:storage_limit');
        await this.release.execute(
          claim,
          reservation,
          response.terminalProof,
          manager,
        );
        const messageId = randomUUID();
        const rows: {
          seq: string;
        }[] = await manager.query(
          `WITH changed AS (UPDATE nodia_ai_conversations
        SET next_message_seq=next_message_seq+1,updated_at=clock_timestamp()
        WHERE id=$1 AND next_message_seq<9223372036854775807 RETURNING next_message_seq::text AS seq) SELECT seq FROM changed`,
          [claim.run.conversation_id],
        );
        if (rows.length !== 1) throw new Error('nodia_ai:execution_limit');
        await manager.query(
          `INSERT INTO nodia_ai_messages
        (id,conversation_id,seq,role,author_id,status,source_scope_manifest,created_at,sealed_at)
        VALUES($1,$2,$3,'assistant',NULL,'sealed',$4::jsonb,clock_timestamp(),clock_timestamp())`,
          [
            messageId,
            claim.run.conversation_id,
            rows[0].seq,
            JSON.stringify({ schema_version: 1, module_routes: data.routes }),
          ],
        );
        if (text.trim())
          await manager.query(
            `INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text)
        VALUES($1,$2,0,'text',$3)`,
            [messageId, claim.run.conversation_id, text],
          );
        if (generated) {
          const current = await this.attachments!.getInTransaction(
            manager,
            claim.identity,
            generated.attachment_id,
            claim.run.conversation_id,
          );
          if (current.state !== 'ready')
            throw new Error('nodia_ai:attachment_not_ready');
          await manager.query(
            `INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text,attachment_id)
            VALUES($1,$2,$4,'image',NULL,$3)`,
            [
              messageId,
              claim.run.conversation_id,
              generated.attachment_id,
              text.trim() ? 1 : 0,
            ],
          );
        }
        await manager.query(
          'UPDATE nodia_ai_runs SET assistant_message_id=$2 WHERE id=$1',
          [claim.run.id, messageId],
        );
        await appendNodiaAiEvent(manager, {
          conversationId: claim.run.conversation_id,
          runId: claim.run.id,
          eventKey: `message:${messageId}:sealed`,
          kind: 'message_sealed',
          payload: { message_id: messageId, status: 'sealed' },
          moduleRoutes: data.routes,
          maxEvents: this.policy.results.outbox_events_per_activity,
          terminal: true,
        });
      },
    };
  }
  private async activateTools(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
  ): Promise<NodiaAiStageOutcome> {
    const pending = await context.checkpoint(async (manager) => {
      const run = await manager
        .getRepository(NodiaAiRun)
        .findOneByOrFail({ id: claim.run.id });
      const state = nodiaAiToolSelectionState(
        run.context_manifest.tool_selection,
      );
      if (!state || state.phase !== 'ack_pending' || !state.request)
        throw new NodiaAiKnownPreDispatchError(
          'nodia_ai:tool_selection_invalid',
        );
      const source = await manager
        .getRepository(NodiaAiJobAttempt)
        .findOneBy({ id: state.request.attempt_id });
      if (
        !source ||
        source.job_id !== claim.job.id ||
        source.phase !== 'completed' ||
        !source.ended_at ||
        source.stage_key !== 'inference' ||
        source.routing_phase === 'delegated' ||
        !['agentic', 'api_key'].includes(
          String(source.selection_snapshot?.mode),
        )
      )
        throw new NodiaAiKnownPreDispatchError(
          'nodia_ai:tool_selection_invalid',
        );
      const rows: {
        id: string;
      }[] = await manager.query(
        'SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1',
        ['ack:' + source.id],
      );
      return { source, acknowledgementId: rows[0]?.id };
    });
    // Native acknowledgement is network I/O and must never run inside a SQL checkpoint.
    if (pending.acknowledgementId)
      await this.cleanupProofs.execute(pending.acknowledgementId);
    const remaining = await context.checkpoint(
      async (manager) =>
        manager.query('SELECT id FROM nodia_ai_jobs WHERE dedup_key=$1', [
          'ack:' + pending.source.id,
        ]) as Promise<
          {
            id: string;
          }[]
        >,
    );
    if (remaining.length)
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:tool_selection_ack_pending',
        true,
      );
    await context.checkpoint(async (manager) => {
      try {
        await this.toolSelection.verifySelection(manager, claim);
      } catch (error: unknown) {
        // This local validation is provably before a provider dispatch. Persistence
        // rechecks it atomically, while normal stale/revoked requests fail promptly.
        if (
          error instanceof Error &&
          /^nodia_ai:[a-z0-9_]{1,100}$/.test(error.message)
        )
          throw new NodiaAiKnownPreDispatchError(error.message);
        throw error;
      }
    });
    return {
      status: 'continue',
      nextStage: 'inference',
      persist: async (manager) => {
        await this.toolSelection.activateSelection(manager, claim);
      },
    };
  }
  private async history(manager: EntityManager, claim: NodiaAiClaim) {
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const frozen = claim.run.context_manifest.module_routes;
    if (
      !Array.isArray(frozen) ||
      frozen.length > 64 ||
      frozen.some(
        (route) => typeof route !== 'string' || !route.startsWith('/'),
      )
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_invalid');
    const admitted = new Set(frozen);
    const routes = actor.modules
      .map((item) => item.route)
      .filter((route) => moduleRouteIncluded([...admitted], route))
      .sort();
    const stored = await this.snapshots.latest(
      manager,
      claim.run.conversation_id,
      claim.run.input_through_seq,
    );
    let snapshot: NodiaAiCompactionSnapshot | undefined;
    if (
      stored &&
      stored.builder_contract_version === NODIA_AI_COMPACTION_BUILDER_VERSION &&
      BigInt(stored.through_message_seq) <
        BigInt(claim.run.input_through_seq) &&
      isDeepStrictEqual(stored.scope_manifest, {
        schema_version: 1,
        module_routes: routes,
      }) &&
      isNodiaAiCompactionSummary(
        stored.summary,
        this.policy.results.json_collection_items,
      )
    ) {
      if (
        (await this.historyReader.fingerprint(
          manager,
          claim.run.conversation_id,
          stored.through_message_seq,
        )) === stored.source_hash
      )
        snapshot = {
          id: stored.id,
          revision: stored.revision,
          throughSeq: stored.through_message_seq,
          sourceHash: stored.source_hash,
          summary: stored.summary,
          scopeManifest: { schema_version: 1, module_routes: routes },
          builderContractVersion: stored.builder_contract_version,
        };
    }
    const window = await this.historyReader.load(manager, {
      conversationId: claim.run.conversation_id,
      actorId: claim.identity.userId,
      throughSeq: claim.run.input_through_seq,
      moduleRoutes: routes,
      afterSeq: snapshot?.throughSeq ?? '0',
      maxBytes: Math.floor(
        (this.policy.results.assembled_context_utf8_bytes * 3) / 4,
      ),
    });
    const sourceHash = await this.historyReader.fingerprint(
      manager,
      claim.run.conversation_id,
      claim.run.input_through_seq,
    );
    const recoveryRefs = await this.loadRecoveryReferences(
      manager,
      claim,
      actor,
      routes,
    );
    const preferences = await this.preferences.loadForContext(
      manager,
      claim.identity,
      routes,
    );
    const capabilityIndex = await this.toolSelection.discoveryIndex(
      manager,
      claim,
    );
    return {
      routes,
      history: window.history,
      preferences,
      snapshot,
      complete: window.complete,
      sourceHash,
      recoveryRefs,
      capabilityIndex,
    };
  }
  private async loadRecoveryReferences(
    manager: EntityManager,
    claim: NodiaAiClaim,
    actor: NodiaAiAuthorizedActor,
    routes: readonly string[],
  ) {
    const recovery = await this.recovery.load(
      manager,
      claim.identity,
      claim.run.conversation_id,
    );
    const published = this.knowledge.manifest.capability_contracts?.some(
      (cap) =>
        cap.capability_id === NODIA_AI_INVOICE_OCR_TOOL &&
        cap.publication === 'published',
    );
    if (!published || !this.invoiceOcr || !routes.includes('/business'))
      return recovery;
    const scopedActor = {
      ...actor,
      modules: actor.modules.filter((m) => moduleRouteIncluded(routes, m.route)),
    };
    return {
      ...recovery,
      invoice_ocr_references: await this.invoiceOcr.loadReferences(
        manager,
        scopedActor,
        claim.run.conversation_id,
        claim.run.input_through_seq,
      ),
    };
  }
  private async checkRouting(
    manager: EntityManager,
    claim: NodiaAiClaim,
    delegated: boolean,
  ) {
    if (!delegated) return;
    const [chat]: {
      routing_enabled: boolean;
      routing_revision: number;
    }[] = await manager.query(
      'SELECT routing_enabled,routing_revision FROM nodia_ai_conversations WHERE id=$1',
      [claim.run.conversation_id],
    );
    if (
      !chat?.routing_enabled ||
      chat.routing_revision !== claim.run.routing_snapshot.revision
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:routing_disabled');
  }
  private async checkSources(
    manager: EntityManager,
    claim: NodiaAiClaim,
    data: Awaited<ReturnType<ProcessNodiaAiStageUseCase['history']>>,
  ) {
    await this.checkPreferences(manager, claim, data);
    const actor = await this.authorize.execute(claim.identity, {}, manager);
    const admitted = claim.run.context_manifest.module_routes;
    const routes = actor.modules
      .map((item) => item.route)
      .filter((route) => Array.isArray(admitted) && moduleRouteIncluded(admitted, route))
      .sort();
    if (
      !isDeepStrictEqual(routes, data.routes) ||
      (await this.historyReader.fingerprint(
        manager,
        claim.run.conversation_id,
        claim.run.input_through_seq,
      )) !== data.sourceHash ||
      !isDeepStrictEqual(
        await this.loadRecoveryReferences(manager, claim, actor, routes),
        data.recoveryRefs,
      ) ||
      !isDeepStrictEqual(
        await this.toolSelection.discoveryIndex(manager, claim),
        data.capabilityIndex,
      )
    )
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:context_sources_changed',
      );
  }
  private async compact(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    selection: NodiaAiClaim['run']['selection_snapshot'],
    data: Awaited<ReturnType<ProcessNodiaAiStageUseCase['history']>>,
    history: ContextHistoryItem[],
  ): Promise<NodiaAiStageOutcome> {
    const throughSeq = history[history.length - 1].seq;
    const sourceHash = await context.checkpoint((manager) =>
      this.historyReader.fingerprint(
        manager,
        claim.run.conversation_id,
        throughSeq,
      ),
    );
    const input = {
      history,
      moduleRoutes: data.routes,
      throughSeq,
      sourceHash,
      previousSnapshot: data.snapshot,
    };
    const observation = await this.observeBeforeDispatch(
      selection,
      context.signal,
    );
    this.rejectRetryableObservationTimeout(
      claim,
      selection,
      observation,
      context.signal,
    );
    if (
      !observation.available ||
      !observation.resourceKey ||
      !observationMatchesManifest(
        selection,
        observation,
        claim.run.context_manifest,
      ) ||
      observation.configurationGeneration !==
        claim.run.context_manifest.configuration_generation ||
      observation.sessionGeneration !==
        claim.run.context_manifest.session_generation ||
      observation.resourceKey !== claim.run.context_manifest.resource_key
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    if (!Object.hasOwn(COMPACTION_RESPONSE_TRANSPORTS, observation.source))
      throw new NodiaAiKnownPreDispatchError('nodia_ai:eligibility_changed');
    let request: ReturnType<BuildNodiaAiCompactionUseCase['execute']>;
    try {
      request = this.compaction.execute(
        input,
        COMPACTION_RESPONSE_TRANSPORTS[observation.source],
      );
    } catch {
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit');
    }
    const nativeBudget = await this.measure(
      { selection, canonicalPrompt: request.prompt },
      context.signal,
    );
    if (this.exceedsContextBudget(nativeBudget))
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit');
    await context.checkpoint(async (manager) => {
      await this.checkSources(manager, claim, data);
      await this.adapter.verifyConfiguration(
        selection,
        observation.configurationGeneration,
        manager,
      );
    });
    const reservation = bindObservationReservation(
      selection,
      observation,
      await this.reserve.execute(
        claim,
        observation.resourceKey,
        claim.attempt.id,
      ),
      claim.attempt.id,
    );
    const dispatchDeadline = await context.armDispatch(
      selection,
      reservation,
      async (manager) => {
        await this.checkSources(manager, claim, data);
        const scope = {
          schema_version: 1,
          module_routes: claim.run.context_manifest.module_routes,
        };
        const [cost]: {
          bytes: string;
        }[] = await manager.query(
          'SELECT ($1::bigint*2+octet_length($2::jsonb::text))::text AS bytes',
          [this.policy.results.assistant_text_utf8_bytes, scope],
        );
        const usage = this.attachments
          ? await this.attachments.usageForAdmission(
              manager,
              claim.run.conversation_id,
              claim.identity.userId,
              new Date(),
            )
          : null;
        if (
          !usage ||
          !cost ||
          BigInt(usage.chat_bytes) + BigInt(cost.bytes) >
            BigInt(this.policy.admission.chat_storage_bytes) ||
          BigInt(usage.owner_bytes) + BigInt(cost.bytes) >
            BigInt(this.policy.admission.owner_storage_bytes)
        )
          throw new NodiaAiKnownPreDispatchError('nodia_ai:storage_limit');
        const reserved: {
          id: string;
        }[] = await manager.query(
          "WITH changed AS (UPDATE nodia_ai_runs SET compactions_used=compactions_used+1 WHERE id=$1 AND compactions_used<LEAST($2,(budget_snapshot->>'compactions')::integer) RETURNING id) SELECT id FROM changed",
          [claim.run.id, this.policy.budget.compactions_per_run],
        );
        if (reserved.length !== 1)
          throw new NodiaAiKnownPreDispatchError('nodia_ai:execution_limit');
      },
    );
    const response = await this.adapter.execute(
      {
        attemptId: claim.attempt.id,
        selection,
        canonicalPrompt: request.prompt,
        deadlineAt: dispatchDeadline,
        resourceKey: observation.resourceKey,
        configurationGeneration: observation.configurationGeneration,
        sessionGeneration: observation.sessionGeneration,
        ...(reservation.adapterIdentity
          ? {
              onLeaseCheck: (signal: AbortSignal) =>
                this.assertRuntimeLease(claim, context, reservation, signal),
            }
          : {}),
        ...(['agentic', 'api_key'].includes(selection.mode)
          ? {
              onProtocolProgress: (
                total: number,
                signal: AbortSignal,
                unforwarded = 0,
              ) =>
                this.compactionProgress(
                  claim,
                  context,
                  reservation,
                  total,
                  signal,
                  unforwarded,
                ),
            }
          : {}),
      },
      context.signal,
    );
    const failure = (errorCode: string): NodiaAiStageOutcome => ({
      status: 'failed',
      errorCode,
      terminalProof: response.terminalProof,
      persist: async (manager) => {
        await this.release.execute(
          claim,
          reservation,
          response.terminalProof,
          manager,
        );
      },
    });
    if (response.kind !== 'answer')
      return failure('nodia_ai:compaction_invalid');
    let summary: ReturnType<BuildNodiaAiCompactionUseCase['parse']>;
    try {
      summary = this.compaction.parse({ ...input, text: response.text });
      // A valid but expanding extraction cannot be advertised as a successful compaction.
      const before = Buffer.byteLength(
        JSON.stringify({ previous: data.snapshot?.summary ?? null, history }),
        'utf8',
      );
      if (Buffer.byteLength(JSON.stringify(summary), 'utf8') >= before)
        return failure('nodia_ai:context_limit');
      await context.checkpoint((manager) =>
        this.checkSources(manager, claim, data),
      );
    } catch (error: unknown) {
      return failure(
        error instanceof NodiaAiKnownPreDispatchError
          ? error.errorCode
          : 'nodia_ai:compaction_invalid',
      );
    }
    return {
      status: 'continue',
      nextStage: 'inference',
      terminalProof: response.terminalProof,
      persist: async (manager) => {
        await this.checkSources(manager, claim, data);
        const [cost]: {
          bytes: string;
        }[] = await manager.query(
          'SELECT (octet_length($1::jsonb::text)+octet_length($2::jsonb::text))::text AS bytes',
          [summary, { schema_version: 1, module_routes: data.routes }],
        );
        const usage = this.attachments
          ? await this.attachments.usageForAdmission(
              manager,
              claim.run.conversation_id,
              claim.identity.userId,
              new Date(),
              claim.run.id,
            )
          : null;
        const bytes =
          BigInt(cost.bytes) +
          BigInt(this.policy.results.assistant_text_utf8_bytes);
        if (
          !usage ||
          BigInt(usage.chat_bytes) + bytes >
            BigInt(this.policy.admission.chat_storage_bytes) ||
          BigInt(usage.owner_bytes) + bytes >
            BigInt(this.policy.admission.owner_storage_bytes)
        )
          throw new Error('nodia_ai:storage_limit');
        const snapshot = await this.snapshots.insert(manager, {
          conversationId: claim.run.conversation_id,
          throughSeq,
          sourceHash,
          summary,
          scopeManifest: { schema_version: 1, module_routes: data.routes },
          builderContractVersion: NODIA_AI_COMPACTION_BUILDER_VERSION,
        });
        const run = await manager
          .getRepository(NodiaAiRun)
          .findOneByOrFail({ id: claim.run.id });
        run.context_snapshot_id = snapshot.id;
        run.context_manifest = {
          ...run.context_manifest,
          compaction: {
            snapshot_id: snapshot.id,
            revision: snapshot.revision,
            through_seq: throughSeq,
            source_hash: sourceHash,
            builder_contract_version: NODIA_AI_COMPACTION_BUILDER_VERSION,
            request_sha256: createHash('sha256')
              .update(request.prompt)
              .digest('hex'),
            request_utf8_bytes: request.sourceBytes,
            summary_utf8_bytes: Buffer.byteLength(
              JSON.stringify(summary),
              'utf8',
            ),
            native_context_budget: { ...nativeBudget },
            mode: selection.mode,
            model_id: selection.model_id,
          },
        };
        await manager.getRepository(NodiaAiRun).save(run);
        await this.release.execute(
          claim,
          reservation,
          response.terminalProof,
          manager,
        );
      },
    };
  }
  private async assertRuntimeLease(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    reservation: NodiaAiRuntimeReservation,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted || context.signal.aborted)
      throw new NodiaAiLostLeaseError();
    await context.checkpoint(async (manager) => {
      const rows: {
        resource_key: string;
      }[] = await manager.query(
        "SELECT resource_key FROM nodia_ai_runtime_slots WHERE resource_key=$1 AND state='held' AND job_id=$2 AND holder_worker_id=$3 AND fence=$4 AND external_operation_ref=$5 AND lease_until>clock_timestamp() FOR SHARE",
        [
          reservation.resourceKey,
          claim.job.id,
          claim.attempt.worker_id,
          reservation.fence,
          reservation.operationRef,
        ],
      );
      if (rows.length !== 1) throw new NodiaAiLostLeaseError();
    });
    if (signal.aborted || context.signal.aborted)
      throw new NodiaAiLostLeaseError();
  }
  private async compactionProgress(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    reservation: NodiaAiRuntimeReservation,
    total: number,
    signal: AbortSignal,
    unforwarded: number,
  ): Promise<void> {
    await this.assertRuntimeLease(claim, context, reservation, signal);
    await this.tools.compactionProgress(claim, context, total, unforwarded);
    await this.assertRuntimeLease(claim, context, reservation, signal);
  }
  private async protocolProgress(
    claim: NodiaAiClaim,
    context: NodiaAiStageContext,
    total: number,
    signal: AbortSignal,
    unforwarded: number,
  ): Promise<void> {
    if (signal.aborted || context.signal.aborted)
      throw new NodiaAiLostLeaseError();
    await this.tools.progress(claim, context, total, unforwarded);
    if (signal.aborted || context.signal.aborted)
      throw new NodiaAiLostLeaseError();
  }
  private async measure(
    input: NodiaAiContextMeasureInput,
    signal: AbortSignal,
  ) {
    const measurement = await this.adapter.measureContext(input, signal);
    if (
      measurement.maxUtf8Bytes !==
      this.policy.results.assembled_context_utf8_bytes
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:context_invalid');
    return measurement;
  }
  private exceedsContextBudget(
    measurement: NodiaAiContextMeasurement,
  ): boolean {
    return (
      measurement.totalUtf8Bytes +
        measurement.firstMcpListingUpperBoundUtf8Bytes >
      measurement.maxUtf8Bytes
    );
  }
  private async checkPreferences(
    manager: EntityManager,
    claim: NodiaAiClaim,
    data: Awaited<ReturnType<ProcessNodiaAiStageUseCase['history']>>,
  ) {
    const current = await this.preferences.loadForContext(
      manager,
      claim.identity,
      data.routes,
    );
    if (
      preferenceFingerprint(current) !== preferenceFingerprint(data.preferences)
    )
      throw new NodiaAiKnownPreDispatchError('nodia_ai:preferences_changed');
  }
  private async observeBeforeDispatch(
    selection: NodiaAiClaim['run']['selection_snapshot'],
    signal: AbortSignal,
  ): Promise<NodiaAiAdapterObservation> {
    try {
      return await this.adapter.observe(selection, signal);
    } catch (error: unknown) {
      // Observation has not armed an inference. Let the durable job policy wait
      // for the physical owner; transport never retries or bypasses its lock.
      if (
        !signal.aborted &&
        error instanceof NodiaAiAdapterError &&
        error.code === 'runtime_busy' &&
        error.outcome === 'not_dispatched'
      )
        throw new NodiaAiKnownPreDispatchError('nodia_ai:runtime_busy', true);
      throw error;
    }
  }
  private rejectRetryableObservationTimeout(
    claim: NodiaAiClaim,
    selection: NodiaAiClaim['run']['selection_snapshot'],
    observation: NodiaAiAdapterObservation,
    signal: AbortSignal,
  ): void {
    // Delegation does not freeze its destination resource key. It remains fail-closed.
    if (claim.job.stage_key === 'delegated_inference') return;
    if (
      !signal.aborted &&
      selection.mode === 'agentic' &&
      observation.adapterContractVersion === 'nodia-ai-gemini-chat/1' &&
      observation.available === false &&
      observation.reason === 'agentic_timeout' &&
      typeof observation.resourceKey === 'string' &&
      observation.resourceKey.length > 0 &&
      typeof observation.configurationGeneration === 'string' &&
      observation.configurationGeneration.length > 0 &&
      typeof observation.sessionGeneration === 'string' &&
      observation.sessionGeneration.length > 0 &&
      observation.resourceKey === claim.run.context_manifest.resource_key &&
      observation.configurationGeneration ===
        claim.run.context_manifest.configuration_generation &&
      observation.sessionGeneration ===
        claim.run.context_manifest.session_generation
    )
      throw new NodiaAiKnownPreDispatchError(
        'nodia_ai:agentic_observation_timeout',
        true,
      );
  }
}
