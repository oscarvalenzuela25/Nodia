import { isUUID } from 'class-validator';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { NodiaAiConversationListQueryDto } from '../dto/nodia-ai-conversation-query.dto.js';
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

/** Date.parse normalizes impossible dates (for example February31); PostgreSQL does not. */
function isCursorTimestamp(value: string): boolean {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}(?:\d{3})?Z$/.test(value) ||
    value.startsWith('0000')
  )
    return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() === value.replace(/(\.\d{3})\d{3}Z$/, '$1Z')
  );
}
@Injectable()
export class ListNodiaAiConversationsUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, input: unknown) {
    const query = validateNodiaAiDto(NodiaAiConversationListQueryDto, input);
    const limit = query.page_limit ?? this.policy.search.default_rows;
    if (limit > this.policy.search.max_rows)
      throw new BadRequestException('nodia_ai:invalid_input');
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(identity, {}, manager);
      if (
        (query.view === 'all' ||
          (query.owner_user_id && query.owner_user_id !== actor.actorId)) &&
        !actor.isSuperAdmin
      )
        throw new ForbiddenException('nodia_ai:capability_denied');
      if (
        query.view !== 'all' &&
        query.owner_user_id &&
        query.owner_user_id !== actor.actorId
      )
        throw new BadRequestException('nodia_ai:invalid_input');
      const ownerId =
        query.view === 'all' ? query.owner_user_id : actor.actorId;
      const scope = cursorScope({
        actor: actor.actorId,
        session: actor.sessionId,
        owner: ownerId ?? null,
        search: query.search ?? null,
        pinned: query.is_pinned ?? null,
        archived: query.is_archived ?? null,
      });
      const after = decodeCursor(query.cursor, scope);
      if (
        after &&
        (after.length !== 2 ||
          !isCursorTimestamp(after[0]) ||
          !isUUID(after[1], '4'))
      )
        throw new BadRequestException('nodia_ai:invalid_cursor');
      const rows = await this.conversations.list(manager, {
        ownerId,
        now: await this.conversations.now(manager),
        search: query.search,
        pinned: query.is_pinned,
        archived: query.is_archived,
        permittedRoutes: actor.modules.map((module) => module.route),
        after,
        limit,
      });
      const items = rows.slice(0, limit);
      const inspectedIds = items
        .filter((chat) => chat.owner_id !== actor.actorId)
        .map((chat) => chat.id);
      if (inspectedIds.length)
        await this.conversations.auditInspections(
          manager,
          actor.actorId,
          actor.sessionId,
          inspectedIds,
          'list',
        );
      const last = items.at(-1);
      return {
        items: items.map((chat) =>
          this.project.execute(chat, chat.owner_id !== actor.actorId),
        ),
        next_cursor:
          rows.length > limit && last
            ? encodeCursor(scope, [
                last.cursor_updated_at ?? last.updated_at.toISOString(),
                last.id,
              ])
            : null,
      };
    });
  }
}
