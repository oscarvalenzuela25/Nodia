import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiAdapterPort } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { UpdateNodiaAiRoutingDto } from '../dto/nodia-ai-routing.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { conversationId } from './get-nodia-ai-conversation.use-case.js';
/** Explicit human configuration. Neither the model nor this switch can approve a business write. */
@Injectable()
export class UpdateNodiaAiRoutingUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
    _adapter: NodiaAiAdapterPort,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    _policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id),
      dto = validateNodiaAiDto(UpdateNodiaAiRoutingDto, input);
    if (dto.enabled || dto.target !== null)
      throw new BadRequestException('nodia_ai:invalid_input');
    const preflight = await this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      this.validate(chat, dto);
      return this.project.execute(chat);
    });
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat, actor, now } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      this.validate(chat, dto);
      if (chat.revision !== preflight.revision)
        throw new ConflictException('nodia_ai:revision_conflict');
      chat.routing_enabled = false;
      chat.routing_target_selection = null;
      chat.routing_revision++;
      chat.revision++;
      chat.updated_at = now;
      await this.conversations.save(manager, chat);
      await manager.query(
        `INSERT INTO nodia_ai_audit_events(id,actor_id,session_public_id,conversation_id,event_key,correlation_id,minimal_details) VALUES($1,$2,$3,$4,'conversation.routing.updated',$5,$6::jsonb)`,
        [
          randomUUID(),
          actor.actorId,
          actor.sessionId,
          chat.id,
          JSON.stringify({
            enabled: chat.routing_enabled,
            routing_revision: chat.routing_revision,
          }),
        ],
      );
      return this.project.execute(chat);
    });
  }
  private validate(chat: NodiaAiConversation, dto: UpdateNodiaAiRoutingDto) {
    if (
      chat.revision !== dto.expected_conversation_revision ||
      chat.routing_revision !== dto.expected_routing_revision ||
      chat.revision >= 2147483647 ||
      chat.routing_revision >= 2147483647
    )
      throw new ConflictException('nodia_ai:revision_conflict');
  }
}
