import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';

@Injectable()
export class AuthorizeNodiaAiConversationUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  async execute(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    conversationId: string,
    mode: 'read' | 'write',
    auditOperation?: string,
  ) {
    const actor = await this.authorize.execute(identity, {}, manager);
    const chat = await this.conversations.find(
      manager,
      conversationId,
      mode === 'write' ? 'pessimistic_write' : 'pessimistic_read',
    );
    if (!chat || (chat.owner_id !== actor.actorId && !actor.isSuperAdmin))
      throw new NotFoundException('nodia_ai:conversation_not_found');
    const now = await this.conversations.now(manager);
    if (chat.lifecycle !== 'active' || now >= chat.expires_at) {
      if (chat.owner_id === actor.actorId)
        throw new GoneException('nodia_ai:conversation_expired');
      throw new NotFoundException('nodia_ai:conversation_not_found');
    }
    if (mode === 'write' && chat.owner_id !== actor.actorId)
      throw new ForbiddenException('nodia_ai:capability_denied');
    if (mode === 'read' && chat.owner_id !== actor.actorId && auditOperation)
      await this.conversations.auditInspection(
        manager,
        actor.actorId,
        actor.sessionId,
        chat.id,
        auditOperation,
      );
    return { actor, chat, now };
  }
}
