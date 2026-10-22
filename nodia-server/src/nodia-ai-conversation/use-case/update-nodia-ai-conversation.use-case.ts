import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { conversationId } from './get-nodia-ai-conversation.use-case.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import { UpdateNodiaAiConversationDto } from '../dto/update-nodia-ai-conversation.dto.js';
import { UpdateNodiaAiSelectionDto } from '../dto/update-nodia-ai-selection.dto.js';
@Injectable()
export class UpdateNodiaAiConversationUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const dto = validateNodiaAiDto(UpdateNodiaAiConversationDto, input);
    if (
      dto.title === undefined &&
      dto.is_pinned === undefined &&
      dto.is_archived === undefined
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    return this.change(
      identity,
      id,
      dto.expected_conversation_revision,
      (chat) => {
        if (dto.title !== undefined) chat.title = dto.title;
        if (dto.is_pinned !== undefined) chat.is_pinned = dto.is_pinned;
        if (dto.is_archived !== undefined) chat.is_archived = dto.is_archived;
      },
    );
  }
  async selection(identity: NodiaAiActorReference, id: string, input: unknown) {
    const dto = validateNodiaAiDto(UpdateNodiaAiSelectionDto, input);
    return this.change(
      identity,
      id,
      dto.expected_conversation_revision,
      (chat) => {
        chat.selected_connection_id = dto.selection.connection_id;
        chat.selected_mode = dto.selection.mode;
        chat.selected_model_id = dto.selection.model_id;
        chat.selected_effort_id = dto.selection.effort_id ?? null;
        if (chat.routing_enabled || chat.routing_target_selection) {
          chat.routing_enabled = false;
          chat.routing_target_selection = null;
          chat.routing_revision++;
        }
      },
    );
  }
  private change(
    identity: NodiaAiActorReference,
    id: string,
    revision: number,
    change: (
      chat: import('../entities/nodia-ai-conversation.entity.js').NodiaAiConversation,
    ) => void,
  ) {
    const key = conversationId(id);
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat, now } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      if (chat.revision !== revision)
        throw new ConflictException('nodia_ai:revision_conflict');
      if (chat.active_job_id)
        throw new ConflictException('nodia_ai:conversation_busy');
      if (chat.revision >= 2147483647 || chat.routing_revision >= 2147483647)
        throw new ConflictException('nodia_ai:revision_conflict');
      change(chat);
      chat.revision++;
      chat.updated_at = now;
      try {
        await this.conversations.save(manager, chat);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23503'
        )
          throw new BadRequestException('nodia_ai:invalid_selection');
        throw error;
      }
      return this.project.execute(chat);
    });
  }
}
