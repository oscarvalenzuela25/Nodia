import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { NodiaAiSelectionDto } from '../dto/nodia-ai-selection.dto.js';
import { NodiaAiRoutingSnapshotDto } from '../dto/nodia-ai-routing.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import type { NodiaAiConversationSummary } from '../types/nodia-ai-persistence.types.js';
@Injectable()
export class ProjectNodiaAiConversationUseCase {
  execute(
    entity: NodiaAiConversation,
    readOnly = false,
  ): NodiaAiConversationSummary {
    try {
      const selection =
        entity.selected_connection_id &&
        entity.selected_mode &&
        entity.selected_model_id
          ? {
              connection_id: entity.selected_connection_id,
              mode: entity.selected_mode,
              model_id: entity.selected_model_id,
              effort_id: entity.selected_effort_id,
            }
          : null;
      const target = entity.routing_target_selection;
      if (
        target !== null &&
        (typeof target !== 'object' || Array.isArray(target))
      )
        throw Error();
      const result: NodiaAiConversationSummary = {
        conversation_id: entity.id,
        owner_user_id: entity.owner_id,
        title: entity.title,
        is_pinned: entity.is_pinned,
        is_archived: entity.is_archived,
        revision: entity.revision,
        selection,
        routing: {
          schema_version: 1,
          enabled: entity.routing_enabled,
          revision: entity.routing_revision,
          target: target
            ? {
                selection: {
                  connection_id: target.selection.connection_id,
                  mode: target.selection.mode,
                  model_id: target.selection.model_id,
                  effort_id: target.selection.effort_id,
                },
                configuration_generation: target.configuration_generation,
                session_generation: target.session_generation,
              }
            : null,
        },
        last_owner_message_at:
          entity.last_owner_message_at?.toISOString() ?? null,
        expires_at: entity.expires_at.toISOString(),
        created_at: entity.created_at.toISOString(),
        updated_at: entity.updated_at.toISOString(),
        read_only: readOnly,
      };
      if (
        entity.selected_effort_id === undefined ||
        (entity.selected_effort_id !== null &&
          (typeof entity.selected_effort_id !== 'string' ||
            !/\S/u.test(entity.selected_effort_id) ||
            Buffer.byteLength(entity.selected_effort_id, 'utf8') > 256))
      )
        throw Error();
      if (selection) validateNodiaAiDto(NodiaAiSelectionDto, selection);
      else if (
        entity.selected_connection_id !== null ||
        (entity.selected_mode === null) !==
          (entity.selected_model_id === null) ||
        (entity.selected_model_id !== null &&
          (typeof entity.selected_model_id !== 'string' ||
            !/\S/u.test(entity.selected_model_id) ||
            Buffer.byteLength(entity.selected_model_id, 'utf8') > 1024)) ||
        (entity.selected_mode !== null &&
          !['api_key', 'agentic'].includes(entity.selected_mode)) ||
        (entity.selected_mode === null && entity.selected_effort_id !== null)
      )
        throw Error();
      validateNodiaAiDto(NodiaAiRoutingSnapshotDto, result.routing);
      if (result.routing.enabled && !result.routing.target) throw Error();
      if (
        result.routing.target &&
        (result.routing.target.selection.effort_id === undefined ||
          result.routing.target.selection.mode !== 'agentic' ||
          (entity.selected_connection_id !== null &&
            result.routing.target.selection.connection_id !==
              entity.selected_connection_id))
      )
        throw Error();
      return result;
    } catch {
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    }
  }
}
