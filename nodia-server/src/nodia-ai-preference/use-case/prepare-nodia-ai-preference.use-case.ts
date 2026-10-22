import { Injectable } from '@nestjs/common';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { validateNodiaAiDto } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import { PrepareNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiPreferenceDto } from '../dto/nodia-ai-preference.dto.js';
import { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import { preferenceInvalid } from '../types/preference.types.js';
@Injectable()
export class PrepareNodiaAiPreferenceUseCase {
  constructor(
    private readonly store: NodiaAiPreferenceService,
    private readonly prepare: PrepareNodiaAiProposalUseCase,
  ) {}
  async execute(identity: NodiaAiActorReference, raw: unknown) {
    const body = validateNodiaAiDto(PrepareNodiaAiPreferenceDto, raw);
    const fields =
      body.operation === 'create'
        ? ['conversation_id', 'operation', 'scope_key', 'scope', 'key', 'value']
        : body.operation === 'update'
          ? [
              'conversation_id',
              'operation',
              'preference_id',
              'expected_revision',
              'value',
            ]
          : [
              'conversation_id',
              'operation',
              'preference_id',
              'expected_revision',
            ];
    if (
      Object.entries(body).some(
        ([key, value]) => value !== undefined && !fields.includes(key),
      ) ||
      fields.some(
        (key) =>
          !Object.hasOwn(body, key) ||
          (body as unknown as Record<string, unknown>)[key] === undefined,
      )
    )
      return preferenceInvalid();
    const partial: NodiaAiJsonObject =
      body.operation === 'create'
        ? {
            scope_key: body.scope_key!,
            scope: body.scope as NodiaAiJsonObject,
            key: body.key!,
            value: body.value!,
          }
        : {
            id: body.preference_id!,
            expected_revision: body.expected_revision!,
            ...(body.operation === 'update' ? { value: body.value! } : {}),
          };
    return this.store.transaction((manager) =>
      this.prepare.execute(manager, identity, {
        conversationId: body.conversation_id,
        toolName: `nodia_preferences_prepare_${body.operation}`,
        partial,
      }),
    );
  }
}
