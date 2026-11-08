import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { NodiaAiConnectionsService } from '../nodia-ai-connections.service.js';
import { defaultNodiaAiSelection } from './nodia-ai-configured-selection.js';
import { ValidateNodiaAiConversationInputUseCase } from './validate-nodia-ai-conversation-input.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import {
  NODIA_AI_CONVERSATION_POLICY,
  type NodiaAiConversationPolicy,
} from '../config/conversation-policy.js';
/** Internal persistence port. No message admission, provider dispatch or public route. */
@Injectable()
export class CreateNodiaAiConversationUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly validate: ValidateNodiaAiConversationInputUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
    @Inject(NODIA_AI_CONVERSATION_POLICY)
    private readonly policy: NodiaAiConversationPolicy,
    private readonly connections: NodiaAiConnectionsService,
  ) {}
  async execute(identity: NodiaAiActorReference, input: unknown) {
    const command = this.validate.execute(input);
    if (
      command.title !== null &&
      Buffer.byteLength(command.title, 'utf8') > this.policy.titleUtf8Bytes
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const hash = createHash('sha256')
      .update(JSON.stringify(command))
      .digest('hex');
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(identity, {}, manager);
      const existing = await this.conversations.findByRequest(
        manager,
        actor.actorId,
        command.client_request_id,
      );
      if (existing) {
        const now = await this.conversations.now(manager);
        if (existing.lifecycle !== 'active' || now >= existing.expires_at)
          throw new GoneException('nodia_ai:conversation_expired');
        return this.existing(existing, hash);
      }
      const now = await this.conversations.now(manager);
      const selection =
        command.selection ??
        defaultNodiaAiSelection(await this.connections.findDefault(manager));
      const entity = Object.assign(new NodiaAiConversation(), {
        id: randomUUID(),
        owner_id: actor.actorId,
        client_request_id: command.client_request_id,
        creation_request_hash: hash,
        title: command.title,
        is_pinned: false,
        is_archived: false,
        revision: 1,
        retention_epoch: '1',
        selected_connection_id: selection?.connection_id ?? null,
        selected_mode: selection?.mode ?? null,
        selected_model_id: selection?.model_id ?? null,
        selected_effort_id: selection?.effort_id ?? null,
        routing_enabled: false,
        routing_revision: 1,
        routing_target_selection: null,
        active_job_id: null,
        next_message_seq: '0',
        next_event_seq: '0',
        last_owner_message_at: null,
        expires_at: new Date(
          now.getTime() + this.policy.retentionDays * 86400000,
        ),
        lifecycle: 'active',
        created_at: now,
        updated_at: now,
      });
      try {
        await this.conversations.insertIfAbsent(manager, entity);
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === '23503'
        )
          throw new BadRequestException('nodia_ai:invalid_selection');
        throw error;
      }
      const saved = await this.conversations.findByRequest(
        manager,
        actor.actorId,
        command.client_request_id,
      );
      if (!saved) throw new ConflictException('nodia_ai:request_conflict');
      return this.existing(saved, hash);
    });
  }
  private existing(entity: NodiaAiConversation, hash: string) {
    if (entity.creation_request_hash !== hash)
      throw new ConflictException('nodia_ai:request_conflict');
    return this.project.execute(entity);
  }
}
