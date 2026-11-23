import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  ApiNodiaAiCredentialsService,
  type NodiaAiApiConfiguration,
} from '../nodia-ai-adapter/api-nodia-ai-credentials.service.js';
import {
  executeApiImage,
  validateApiPayload,
} from '../nodia-ai-adapter/api-nodia-ai-chat-transport.js';
import { NodiaAiAdapterError } from '../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';
import { teacherError } from '../teacher/policies/teacher-validation.js';
import type { TeacherSelection } from '../teacher/types/teacher.types.js';
import type { AiGenerationExecutionContext } from './ai-generation-port.js';
import { ApiTextGenerationService } from './api-text-generation.service.js';
import { normalizeFlashcardLibraryImage } from './flashcard-library-transport-image.js';

const imageContract = 'teacher-flashcard-library-image/1';
export const FLASHCARD_IMAGE_QUALIFICATION_PROMPT =
  'Create one small educational illustration of an orange triangle above a blue circle on a neutral background. Use flat colors and no lettering or other elements.';

export type FlashcardLibraryTransportKind = 'text' | 'image';
export type FlashcardLibraryTransportResult = {
  text: string;
  responseHash: string;
  image?: { bytes: Buffer; mime: 'image/webp' };
};

export function flashcardImageQualificationScope(
  selection: TeacherSelection,
  config: NodiaAiApiConfiguration,
) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contract: imageContract,
        provider: config.providerKey,
        connection: config.connectionId,
        key: config.keyId,
        model: selection.model_id,
        effort: selection.effort_id,
        mode: selection.mode,
        configuration: config.configurationGeneration,
        session: config.sessionGeneration,
        resource: config.resourceKey,
      }),
    )
    .digest('hex');
}

/** Transport for the library worker. It never arms a dispatch outside its fenced callback. */
@Injectable()
export class FlashcardLibraryTransport {
  constructor(
    private readonly source: DataSource,
    private readonly credentials: ApiNodiaAiCredentialsService,
    private readonly text: ApiTextGenerationService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async configure(
    selection: TeacherSelection,
    kind: FlashcardLibraryTransportKind,
    manager = this.source.manager,
    qualification?: true,
  ): Promise<NodiaAiApiConfiguration> {
    if (selection.mode !== 'api_key')
      teacherError('flashcard_library_mode_unsupported', 422);
    let config: NodiaAiApiConfiguration;
    try {
      config = await this.credentials.configuration(selection, manager);
    } catch (error) {
      if (error instanceof NodiaAiAdapterError)
        teacherError('flashcard_library_configuration_unavailable', 422);
      throw error;
    }
    if (kind !== 'image') return config;
    if (config.providerKey === 'openai' && selection.effort_id !== null)
      teacherError('flashcard_image_effort_unsupported', 422);
    if (!qualification) {
      const [accepted] = await manager.query(
        'SELECT operation_id FROM teacher_flashcard_image_qualifications WHERE scope_hash=$1 AND contract_version=$2',
        [flashcardImageQualificationScope(selection, config), imageContract],
      );
      if (!accepted) teacherError('flashcard_image_unqualified', 422);
    }
    return config;
  }

  async execute(
    kind: FlashcardLibraryTransportKind,
    context: AiGenerationExecutionContext,
    signal: AbortSignal,
    qualification?: true,
  ): Promise<FlashcardLibraryTransportResult> {
    signal.throwIfAborted();
    if (kind === 'text') {
      if (qualification)
        teacherError('flashcard_image_qualification_invalid', 422);
      const { text, responseHash } = await this.text.execute(context, signal);
      return { text, responseHash };
    }
    if (
      qualification &&
      context.prompt !== FLASHCARD_IMAGE_QUALIFICATION_PROMPT
    )
      teacherError('flashcard_image_qualification_invalid', 422);
    const config = await this.configure(
      context.selection,
      'image',
      undefined,
      qualification,
    );
    if (
      config.configurationGeneration !== context.configurationGeneration ||
      config.sessionGeneration !== context.sessionGeneration ||
      config.resourceKey !== context.resourceKey
    )
      teacherError('configuration_changed', 409);

    const request = {
      attemptId: context.operationId,
      selection: context.selection,
      canonicalPrompt: context.prompt,
      imageGeneration: { prompt: context.prompt },
      deadlineAt: context.deadlineAt,
      resourceKey: context.resourceKey,
      configurationGeneration: context.configurationGeneration,
      sessionGeneration: context.sessionGeneration,
      tools: [],
      attachments: [],
      onLeaseCheck: () => context.checkLease(),
    };
    validateApiPayload(request, this.policy);
    const input = {
      provider: config.providerKey,
      secret: await this.credentials.secret(context.selection, config),
      policy: this.policy,
      signal,
      request,
      beforeExchange: () => context.beforeExchange(),
    };
    try {
      const { generatedImage } = await executeApiImage(input);
      const image = await normalizeFlashcardLibraryImage(
        generatedImage,
        signal,
      );
      await context.checkLease();
      return {
        text: '',
        responseHash: createHash('sha256').update(image.bytes).digest('hex'),
        image,
      };
    } finally {
      input.secret = '';
    }
  }

  /** Explicit operator promotion of a durable, acknowledged synthetic image result. */
  async acceptImageQualification(
    manager: EntityManager,
    selection: TeacherSelection,
    operationId: string,
    ownerUserId: string,
  ): Promise<void> {
    const config = await this.configure(selection, 'image', manager, true);
    const [qualified] = await manager.query(
      `INSERT INTO teacher_flashcard_image_qualifications(scope_hash,contract_version,operation_id,response_hash,observed_at)
       SELECT $2,$3,op.id,op.response_hash,op.acknowledged_at FROM ai_generation_operations op
       JOIN teacher_flashcard_library_parts part ON part.id=op.flashcard_part_id
       JOIN teacher_flashcard_library_proposals proposal ON proposal.id=op.flashcard_proposal_id
       WHERE op.id=$1 AND op.owner_kind='flashcard_library' AND proposal.qualification=true
       AND part.proposal_id=proposal.id AND part.kind='image' AND part.state='ready' AND part.prompt=$10
       AND op.actor_id=$9 AND proposal.owner_user_id=$9
       AND op.selection_snapshot=$4::jsonb AND op.configuration_generation=$5 AND op.session_generation=$6
       AND op.resource_key=$7 AND op.selected_key_id=$8
       AND part.selection_snapshot=op.selection_snapshot AND part.configuration_generation=op.configuration_generation
       AND part.session_generation=op.session_generation AND part.resource_key=op.resource_key
       AND op.phase='closed' AND op.acknowledged_at IS NOT NULL
       AND op.started_exchanges=1 AND op.reserved_exchanges=1 AND op.exchange_limit=1
       AND op.remote_outcome='completed' AND op.response_hash=encode(sha256(part.image_bytes),'hex')
       AND part.image_mime='image/webp' AND op.terminal_proof->'local_transport_closed'='true'::jsonb
       AND op.terminal_proof->>'contract'='teacher-flashcard-library/1'
       AND op.terminal_proof->'owner'=op.api_owner_identity
       AND op.terminal_proof->>'owner_fence'=op.owner_fence::text
       AND op.terminal_proof->>'runtime_fence'=op.runtime_fence::text
       AND op.terminal_proof->>'closure_basis'='same_executor_return'
       AND op.terminal_proof->>'remote_outcome'='completed'
       AND op.terminal_proof->>'operation_id'=op.id::text
       AND op.terminal_proof->>'request_hash'=op.request_hash
       AND op.terminal_proof->>'response_hash'=op.response_hash
       ON CONFLICT (scope_hash) DO UPDATE SET operation_id=EXCLUDED.operation_id,
         response_hash=EXCLUDED.response_hash,observed_at=EXCLUDED.observed_at
       RETURNING operation_id`,
      [
        operationId,
        flashcardImageQualificationScope(selection, config),
        imageContract,
        JSON.stringify(selection),
        config.configurationGeneration,
        config.sessionGeneration,
        config.resourceKey,
        config.keyId,
        ownerUserId,
        FLASHCARD_IMAGE_QUALIFICATION_PROMPT,
      ],
    );
    if (!qualified) teacherError('flashcard_image_qualification_invalid', 422);
  }
}
