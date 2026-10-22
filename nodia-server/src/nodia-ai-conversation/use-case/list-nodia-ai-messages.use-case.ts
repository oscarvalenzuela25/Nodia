import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { conversationId } from './get-nodia-ai-conversation.use-case.js';
import { NodiaAiMessageListQueryDto } from '../dto/nodia-ai-conversation-query.dto.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import {
  cursorScope,
  decodeCursor,
  encodeCursor,
} from './nodia-ai-pagination.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';

export function canReadNodiaAiManifest(
  input: unknown,
  routes: readonly string[],
): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const manifest = input as Record<string, unknown>;
  return (
    Object.keys(manifest).length === 2 &&
    manifest.schema_version === 1 &&
    Array.isArray(manifest.module_routes) &&
    manifest.module_routes.length <= 64 &&
    manifest.module_routes.every(
      (route: unknown) => typeof route === 'string' && routes.includes(route),
    )
  );
}
@Injectable()
export class ListNodiaAiMessagesUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const query = validateNodiaAiDto(NodiaAiMessageListQueryDto, input);
    const backward = query.direction === 'backward';
    const limit = query.page_limit ?? this.policy.results.list_default_rows;
    if (limit > this.policy.results.list_max_rows)
      throw new BadRequestException('nodia_ai:invalid_input');
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { actor, chat } = await this.access.execute(
        manager,
        identity,
        key,
        'read',
        'messages',
      );
      const scope = cursorScope({
        actor: actor.actorId,
        session: actor.sessionId,
        chat: chat.id,
        epoch: chat.retention_epoch,
        ...(backward ? { direction: 'backward' } : {}),
      });
      const after = decodeCursor(query.cursor, scope);
      if (
        after &&
        (after.length !== 1 ||
          !/^[1-9]\d{0,18}$/.test(after[0]) ||
          BigInt(after[0]) > 9223372036854775807n)
      )
        throw new BadRequestException('nodia_ai:invalid_cursor');
      const args = [manager, key, after?.[0], limit] as const;
      const rows = backward
        ? await this.conversations.messages(...args, 'backward')
        : await this.conversations.messages(...args);
      const window = rows.slice(0, limit);
      const messages = backward ? [...window].reverse() : window;
      const routes = actor.modules.map((module) => module.route);
      const visible = messages.filter((message) =>
        canReadNodiaAiManifest(message.source_scope_manifest, routes),
      );
      const parts = await this.conversations.parts(
        manager,
        visible.map((message) => message.id),
      );
      const messageIds = messages.map((message) => message.id);
      const messageIdSet = new Set(messageIds);
      const runRefs = await this.conversations.messageRuns(manager, messageIds);
      const runIds = new Map<string, string>();
      for (const run of runRefs) {
        for (const messageId of [
          run.user_message_id,
          run.assistant_message_id,
        ]) {
          if (!messageId || !messageIdSet.has(messageId)) continue;
          if (runIds.has(messageId) && runIds.get(messageId) !== run.id)
            throw new InternalServerErrorException(
              'nodia_ai:invalid_persisted_state',
            );
          runIds.set(messageId, run.id);
        }
      }
      if (runRefs.length > messageIds.length)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      const items = messages.map((message) => {
        const base = {
          message_id: message.id,
          run_id: runIds.get(message.id) ?? null,
          seq: message.seq,
          role: message.role,
          status: message.status,
          created_at: message.created_at.toISOString(),
        };
        if (!visible.includes(message))
          return { ...base, visibility: 'restricted' as const };
        return {
          ...base,
          visibility: 'visible' as const,
          author_user_id: message.author_id,
          sealed_at: message.sealed_at?.toISOString() ?? null,
          parts: parts
            .filter((part) => part.message_id === message.id)
            .map((part) =>
              part.kind === 'text'
                ? { kind: 'text' as const, text: part.text }
                : {
                    kind: part.kind,
                    attachment_id: part.attachment_id,
                    text: part.text,
                  },
            ),
        };
      });
      return {
        conversation_id: chat.id,
        items,
        next_cursor:
          rows.length > limit
            ? encodeCursor(scope, [window.at(-1)!.seq])
            : null,
      };
    });
  }
}
