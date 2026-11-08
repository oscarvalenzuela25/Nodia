import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiNodiaAiCredentialsService } from '../api-nodia-ai-credentials.service.js';
import {
  apiChatBody,
  executeApiChat,
  executeApiImage,
  validateApiPayload,
} from '../api-nodia-ai-chat-transport.js';
import {
  initialApiHistory,
  validateApiMedia,
  apiMediaSupported,
} from '../api-nodia-ai-media.js';
import {
  ApiNodiaAiAcceptanceService,
  type ApiNodiaAiCanary,
} from '../api-nodia-ai-acceptance.service.js';
import {
  ApiNodiaAiRuntimeService,
  apiReplyDigest,
} from '../api-nodia-ai-runtime.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NodiaAiAdapterError,
  NodiaAiAdapterPort,
  nodiaAiMcpCatalogUtf8Bytes,
  type NodiaAiAdapterRequest,
  type NodiaAiAdapterObservation,
  type NodiaAiAdapterReply,
  type NodiaAiContextMeasureInput,
  type NodiaAiContextMeasurement,
} from '../types/nodia-ai-adapter.types.js';

/** Configuration readiness is not evidence of remote availability or successful inference. */
@Injectable()
export class ApiNodiaAiAdapterUseCase extends NodiaAiAdapterPort {
  constructor(
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly runtime: ApiNodiaAiRuntimeService,
    private readonly acceptance: ApiNodiaAiAcceptanceService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {
    super();
  }

  async observe(
    selection: NodiaAiSelection,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterObservation> {
    signal?.throwIfAborted();
    const config = await this.credentials.configuration(selection);
    const accepted = await this.acceptance.read(config, selection);
    signal?.throwIfAborted();
    return {
      available: true,
      observedAt: new Date(),
      source: 'api_configuration_and_catalog',
      adapterContractVersion: 'nodia-ai-api-chat/1',
      adapterIdentity: {
        providerKey: config.providerKey,
        connectionId: config.connectionId,
        contractVersion: 'nodia-ai-api-chat/1',
      },
      resourceKey: config.resourceKey,
      sessionGeneration: config.sessionGeneration,
      configurationGeneration: config.configurationGeneration,
      supportsMcp: false,
      supportsTools: true,
      supportsImageGeneration: accepted.imageGeneration,
      verifiedModalities: [
        ...new Set(
          accepted.verifiedMediaTypes.map((mime) =>
            mime.startsWith('image/')
              ? ('image' as const)
              : mime === 'application/pdf'
                ? ('pdf' as const)
                : ('audio' as const),
          ),
        ),
      ],
      verifiedAttachmentMediaTypes: accepted.verifiedMediaTypes,
      reason: null,
    };
  }

  async verifyConfiguration(
    selection: NodiaAiSelection,
    generation: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (
      !/^[a-f0-9]{64}$/.test(generation) ||
      (await this.credentials.configuration(selection, manager))
        .configurationGeneration !== generation
    )
      throw new NodiaAiAdapterError(
        'adapter_configuration_changed',
        'not_dispatched',
      );
  }

  async measureContext(
    input: NodiaAiContextMeasureInput,
    signal?: AbortSignal,
  ): Promise<NodiaAiContextMeasurement> {
    signal?.throwIfAborted();
    const config = await this.credentials.configuration(input.selection);
    validateApiPayload(input, this.policy);
    const accepted = await this.acceptance.read(config, input.selection);
    if (
      input.attachments?.some(
        (ref) =>
          !ref.media_type ||
          !apiMediaSupported(config.providerKey, ref.kind, ref.media_type) ||
          !accepted.verifiedMediaTypes.includes(ref.media_type),
      )
    )
      throw new NodiaAiAdapterError(
        'adapter_attachments_unverified',
        'not_dispatched',
      );
    const canonicalUtf8Bytes = Buffer.byteLength(input.canonicalPrompt, 'utf8');
    const catalogUtf8Bytes = nodiaAiMcpCatalogUtf8Bytes(input.tools ?? []);
    // Exact initial prompt/catalog REST bytes. Inline originals have independent
    // admission/transport ceilings; no claim about provider/model token windows.
    const measurementRequest = {
      selection: input.selection,
      canonicalPrompt: input.canonicalPrompt,
      tools: input.tools,
    } as NodiaAiAdapterRequest;
    const totalUtf8Bytes = Buffer.byteLength(
      JSON.stringify(
        apiChatBody(
          config.providerKey,
          measurementRequest,
          initialApiHistory(config.providerKey, measurementRequest),
        ),
      ),
      'utf8',
    );
    return {
      measurementContractVersion: 'nodia-ai-context-budget/1',
      measurementScope: 'initial_api_prompt',
      measurementKind: 'exact',
      canonicalUtf8Bytes,
      catalogUtf8Bytes,
      overheadUtf8Bytes: Math.max(
        0,
        totalUtf8Bytes - canonicalUtf8Bytes - catalogUtf8Bytes,
      ),
      totalUtf8Bytes,
      maxUtf8Bytes: this.policy.results.assembled_context_utf8_bytes,
      modelContextTokens: null,
      firstMcpListingUpperBoundUtf8Bytes: 0,
    };
  }

  async execute(
    original: NodiaAiAdapterRequest,
    signal?: AbortSignal,
  ): Promise<NodiaAiAdapterReply> {
    return this.executeInternal(original, signal);
  }

  /** Operator-only canary; normal owner messages cannot bypass format qualification. */
  async qualifyMedia(
    request: NodiaAiAdapterRequest,
    canary: ApiNodiaAiCanary,
    signal: AbortSignal,
  ) {
    this.acceptance.validateCanary(request, canary);
    const config = await this.credentials.configuration(request.selection);
    const reply = await this.executeInternal(request, signal, canary);
    const accepted = await this.acceptance.qualify(
      config,
      request,
      reply,
      canary,
      signal,
    );
    return { reply, acceptance: accepted };
  }

  private async executeInternal(
    original: NodiaAiAdapterRequest,
    signal?: AbortSignal,
    canary?: ApiNodiaAiCanary,
  ): Promise<NodiaAiAdapterReply> {
    validateApiPayload(original, this.policy);
    const remaining =
      original.deadlineAt instanceof Date
        ? original.deadlineAt.getTime() - Date.now()
        : NaN;
    if (!Number.isFinite(remaining) || remaining <= 0)
      throw new NodiaAiAdapterError(
        'adapter_deadline_expired',
        'not_dispatched',
      );
    if (
      !original.onLeaseCheck ||
      !original.onProtocolProgress ||
      (original.tools?.length && !original.onToolCall)
    )
      throw new NodiaAiAdapterError(
        'mcp_callback_unconfigured',
        'not_dispatched',
      );
    const request: NodiaAiAdapterRequest = {
      ...original,
      selection: Object.freeze({ ...original.selection }),
      deadlineAt: new Date(original.deadlineAt),
      tools: original.tools ? structuredClone(original.tools) : [],
    };
    if (original.attachments)
      request.attachments = structuredClone(original.attachments);
    if (original.imageGeneration)
      request.imageGeneration = Object.freeze({ ...original.imageGeneration });
    const deadline = AbortSignal.timeout(
      Math.min(remaining, this.policy.timing.provider_dispatch_seconds * 1000),
    );
    const controller = new AbortController();
    const combined = AbortSignal.any([
      controller.signal,
      deadline,
      ...(signal ? [signal] : []),
    ]);
    if (combined.aborted)
      throw new NodiaAiAdapterError(
        'adapter_cancelled_before_dispatch',
        'not_dispatched',
      );
    const config = await this.credentials.configuration(request.selection);
    if (
      config.configurationGeneration !== request.configurationGeneration ||
      config.resourceKey !== request.resourceKey ||
      config.sessionGeneration !== request.sessionGeneration
    )
      throw new NodiaAiAdapterError(
        'adapter_configuration_changed',
        'not_dispatched',
      );
    validateApiMedia(config.providerKey, request, this.policy);
    const accepted = await this.acceptance.read(config, request.selection);
    if (
      !canary &&
      (request.attachments?.some(
        (ref) => !accepted.verifiedMediaTypes.includes(ref.media_type),
      ) ||
        (request.imageGeneration && !accepted.imageGeneration))
    )
      throw new NodiaAiAdapterError(
        'adapter_attachments_unverified',
        'not_dispatched',
      );
    if (
      request.imageGeneration &&
      config.providerKey === 'openai' &&
      request.selection.effort_id !== null
    )
      throw new NodiaAiAdapterError(
        'api_image_effort_unsupported',
        'not_dispatched',
      );
    let secret = await this.credentials.secret(request.selection, config);
    await request.onLeaseCheck!(combined);
    let started = false;
    let completionAttempted = false;
    try {
      await this.runtime.start(request,config);
      started = true;
      const transportInput = {
        provider: config.providerKey,
        secret,
        request,
        policy: this.policy,
        signal: combined,
        beforeExchange: async () => {
          await this.verifyConfiguration(
            request.selection,
            request.configurationGeneration,
          );
          await request.onLeaseCheck!(combined);
          combined.throwIfAborted();
          await this.runtime.reserveExchange(request);
        },
      };
      const result = request.imageGeneration
        ? await executeApiImage(transportInput)
        : { text: await executeApiChat(transportInput) };
      // The non-streaming transport has awaited every reader and gateway callback.
      controller.abort();
      completionAttempted = true;
      const terminalProof = await this.runtime.finish(
        request,
        'completed',
        apiReplyDigest(result),
      );
      return { kind: 'answer', ...result, terminalProof };
    } catch (error) {
      controller.abort();
      if (started) {
        if (!completionAttempted) {
          try {
            await this.runtime.finish(request, 'unknown');
          } catch {
            /* Durable reconciliation owns a lost terminal commit; never replay inference. */
          }
        }
        throw new NodiaAiAdapterError(
          error instanceof NodiaAiAdapterError
            ? error.code
            : 'api_result_unknown',
          'unknown',
        );
      }
      if (error instanceof NodiaAiAdapterError) throw error;
      throw new NodiaAiAdapterError('api_runtime_start_failed', 'unknown');
    } finally {
      controller.abort();
      secret = '';
    }
  }
}
