import type { EntityManager } from 'typeorm';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { validateNodiaAiDto } from '../../nodia-ai-conversation/dto/nodia-ai-validation.js';
import {
  cursorScope,
  decodeCursor,
  encodeCursor,
} from '../../nodia-ai-conversation/use-case/nodia-ai-pagination.js';
import { NodiaAiPreferenceQueryDto } from '../dto/nodia-ai-preference.dto.js';
import { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import { NodiaAiPreferenceReaderUseCase } from './nodia-ai-preference-reader.use-case.js';
@Injectable()
export class ListNodiaAiPreferencesUseCase {
  constructor(
    private readonly store: NodiaAiPreferenceService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly reader: NodiaAiPreferenceReaderUseCase,
  ) {}
  async execute(identity: NodiaAiActorReference, raw: unknown) {
    return this.store.transaction(async (manager) => {
      await lockAuthority(manager);
      return this.executeInTransaction(manager, identity, raw);
    });
  }
  /** Own preferences only, including super_admin. No nested transaction in MCP. */
  async executeInTransaction(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    raw: unknown,
  ) {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException(
        'authorization:transaction_required',
      );
    const query = validateNodiaAiDto(NodiaAiPreferenceQueryDto, raw),
      limit = query.page_limit ?? 20;
    if (limit > 50) throw new BadRequestException('nodia_ai:invalid_input');
    const actor = await this.authorize.execute(identity, {}, manager);
    const scope = cursorScope({
        actor: actor.actorId,
        session: actor.sessionId,
        scope: query.scope_key ?? null,
      }),
      after = decodeCursor(query.cursor, scope);
    if (after && (after.length !== 1 || !isUUID(after[0], '4')))
      throw new BadRequestException('nodia_ai:invalid_cursor');
    const all = await this.reader.project(
      manager,
      actor,
      await this.store.list(manager, actor.actorId),
      actor.modules.map((module) => module.route),
    );
    const rows = all.filter(
      (row) =>
        (!query.scope_key || row.scope_key === query.scope_key) &&
        (!after || row.preference_id > after[0]),
    );
    const items = rows.slice(0, limit),
      last = items.at(-1);
    return {
      items,
      next_cursor:
        rows.length > limit && last
          ? encodeCursor(scope, [last.preference_id])
          : null,
    };
  }
}
