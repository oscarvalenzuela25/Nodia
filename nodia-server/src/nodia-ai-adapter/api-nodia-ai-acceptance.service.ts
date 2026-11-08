import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { NodiaAiSelection } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { assertRuntimeTerminalProof } from '../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';
import {
  NodiaAiAdapterError,
  type NodiaAiAdapterReply,
  type NodiaAiAdapterRequest,
} from './types/nodia-ai-adapter.types.js';
import {
  ApiNodiaAiCredentialsService,
  type NodiaAiApiConfiguration,
  apiObject,
} from './api-nodia-ai-credentials.service.js';
import { ApiNodiaAiRuntimeService } from './api-nodia-ai-runtime.service.js';

export const NODIA_AI_API_CHAT_CONTRACT = 'nodia-ai-api-chat/1';
export const API_INPUT_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
] as const;
export interface ApiNodiaAiCanary {
  nonce: string;
  expectedText: readonly string[];
  mediaType?: string;
  imageGeneration?: true;
}
export interface ApiNodiaAiAcceptance {
  verifiedMediaTypes: readonly string[];
  imageGeneration: boolean;
  observedAt: Date | null;
}
export function apiAcceptanceScope(
  config: NodiaAiApiConfiguration,
  selection: NodiaAiSelection,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contractVersion: NODIA_AI_API_CHAT_CONTRACT,
        providerKey: config.providerKey,
        connectionId: config.connectionId,
        configurationGeneration: config.configurationGeneration,
        sessionGeneration: config.sessionGeneration,
        modelId: selection.model_id,
        effortId: selection.effort_id,
      }),
    )
    .digest('hex');
}
function deny(): never {
  throw new NodiaAiAdapterError('api_acceptance_invalid', 'not_dispatched');
}

/** Internal operator evidence only; no DTO, public endpoint or model tool publishes qualification. */
@Injectable()
export class ApiNodiaAiAcceptanceService {
  constructor(
    private readonly source: DataSource,
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly runtime: ApiNodiaAiRuntimeService,
  ) {}

  async read(
    config: NodiaAiApiConfiguration,
    selection: NodiaAiSelection,
  ): Promise<ApiNodiaAiAcceptance> {
    const rows: unknown = await this.source.manager.query(
      `SELECT verified_media_types,image_generation,observed_at FROM nodia_ai_api_acceptances WHERE scope_hash=$1`,
      [apiAcceptanceScope(config, selection)],
    );
    if (Array.isArray(rows) && rows.length === 0)
      return {
        verifiedMediaTypes: [],
        imageGeneration: false,
        observedAt: null,
      };
    const row =
      Array.isArray(rows) && rows.length === 1 ? apiObject(rows[0]) : null;
    if (
      !row ||
      !Array.isArray(row.verified_media_types) ||
      row.verified_media_types.some(
        (mime) => !API_INPUT_MEDIA_TYPES.includes(mime),
      ) ||
      typeof row.image_generation !== 'boolean' ||
      !Number.isFinite(new Date(String(row.observed_at)).getTime())
    )
      return deny();
    return {
      verifiedMediaTypes: row.verified_media_types as string[],
      imageGeneration: row.image_generation,
      observedAt: new Date(String(row.observed_at)),
    };
  }

  validateCanary(
    request: NodiaAiAdapterRequest,
    canary: ApiNodiaAiCanary,
  ): void {
    if (
      !canary ||
      typeof canary.nonce !== 'string' ||
      !/^[a-zA-Z0-9_-]{16,128}$/.test(canary.nonce) ||
      !request.canonicalPrompt.includes(canary.nonce) ||
      !Array.isArray(canary.expectedText) ||
      canary.expectedText.length > 16 ||
      canary.expectedText.some(
        (text) =>
          typeof text !== 'string' ||
          !text.trim() ||
          Buffer.byteLength(text, 'utf8') > 256,
      ) ||
      canary.expectedText.some(
        (text) =>
          request.canonicalPrompt.includes(text) ||
          request.imageGeneration?.prompt.includes(text),
      ) ||
      !!canary.mediaType === !!canary.imageGeneration ||
      (canary.mediaType !== undefined &&
        (!API_INPUT_MEDIA_TYPES.includes(
          canary.mediaType as (typeof API_INPUT_MEDIA_TYPES)[number],
        ) ||
          request.attachments?.length !== 1 ||
          request.attachments[0].media_type !== canary.mediaType ||
          !canary.expectedText.length)) ||
      (canary.imageGeneration &&
        (!request.imageGeneration ||
          !request.imageGeneration.prompt.includes(canary.nonce)))
    )
      return deny();
  }

  async qualify(
    config: NodiaAiApiConfiguration,
    request: NodiaAiAdapterRequest,
    reply: NodiaAiAdapterReply,
    canary: ApiNodiaAiCanary,
    signal: AbortSignal,
  ): Promise<ApiNodiaAiAcceptance> {
    this.validateCanary(request, canary);
    signal.throwIfAborted();
    if (
      (await this.credentials.configuration(request.selection))
        .configurationGeneration !== config.configurationGeneration ||
      reply.kind !== 'answer' ||
      reply.terminalProof.engine !== 'api_key' ||
      reply.terminalProof.outcome !== 'completed' ||
      reply.terminalProof.remoteOutcome !== 'completed' ||
      reply.terminalProof.localTransportClosed !== true ||
      reply.terminalProof.resourceKey !== config.resourceKey ||
      reply.terminalProof.sessionGeneration !== config.sessionGeneration ||
      reply.terminalProof.attemptId !== request.attemptId ||
      reply.terminalProof.adapterIdentity.providerKey !== config.providerKey ||
      reply.terminalProof.adapterIdentity.connectionId !== config.connectionId
    )
      return deny();
    // The durable runtime must attest this terminal; a caller-supplied boolean cannot qualify anything.
    const durable = await this.runtime.reconcile(reply.terminalProof, signal);
    const binding = await this.runtime.assertCompletedRequest(
      request,
      reply.terminalProof,
      reply,
    );
    assertRuntimeTerminalProof(reply.terminalProof, durable);
    if (
      durable.terminalProofId !== reply.terminalProof.terminalProofId ||
      durable.outcome !== 'completed'
    )
      return deny();
    if (
      canary.imageGeneration
        ? !reply.generatedImage
        : !reply.text.includes(canary.nonce) ||
          canary.expectedText.some((marker) => !reply.text.includes(marker))
    )
      return deny();
    const evidence = {
      contract_version: NODIA_AI_API_CHAT_CONTRACT,
      terminal_proof_id: durable.terminalProofId,
      attempt_id: request.attemptId,
      nonce_sha256: createHash('sha256').update(canary.nonce).digest('hex'),
      reply_sha256: createHash('sha256').update(reply.text).digest('hex'),
      request_hash: binding.requestHash,
      response_hash: binding.responseHash,
      observed_at: durable.observedAt.toISOString(),
      ...(canary.mediaType
        ? {
            media_type: canary.mediaType,
            input_sha256: request.attachments![0].sha256,
          }
        : {
            generated_image_sha256: reply.generatedImage!.sha256,
            generated_image_media_type: reply.generatedImage!.mediaType,
          }),
    };
    const encoded = JSON.stringify({
      [canary.mediaType ?? 'image_generation']: evidence,
    });
    if (Buffer.byteLength(encoded, 'utf8') > 8192) return deny();
    const saved: unknown = await this.source.manager.query(
      `INSERT INTO nodia_ai_api_acceptances(scope_hash,provider_key,connection_id,configuration_generation,session_generation,
       model_id,effort_id,verified_media_types,image_generation,evidence,observed_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now())
       ON CONFLICT(scope_hash) DO UPDATE SET verified_media_types=ARRAY(SELECT DISTINCT unnest(nodia_ai_api_acceptances.verified_media_types || EXCLUDED.verified_media_types)),
       image_generation=nodia_ai_api_acceptances.image_generation OR EXCLUDED.image_generation,
       evidence=nodia_ai_api_acceptances.evidence || EXCLUDED.evidence,observed_at=EXCLUDED.observed_at
       WHERE octet_length((nodia_ai_api_acceptances.evidence || EXCLUDED.evidence)::text)<=8192 RETURNING scope_hash`,
      [
        apiAcceptanceScope(config, request.selection),
        config.providerKey,
        config.connectionId,
        config.configurationGeneration,
        config.sessionGeneration,
        request.selection.model_id,
        request.selection.effort_id,
        canary.mediaType ? [canary.mediaType] : [],
        canary.imageGeneration === true,
        encoded,
      ],
    );
    if (
      !Array.isArray(saved) ||
      saved.length !== 1 ||
      apiObject(saved[0])?.scope_hash !==
        apiAcceptanceScope(config, request.selection)
    )
      return deny();
    return this.read(config, request.selection);
  }
}
