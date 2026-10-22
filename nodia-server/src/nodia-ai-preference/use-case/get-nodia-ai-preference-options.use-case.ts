import { BadRequestException, Injectable } from '@nestjs/common';
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
import { NodiaAiPreferenceOptionsDto } from '../dto/nodia-ai-preference.dto.js';
import { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import {
  preferenceDefinition,
  preferenceInvalid,
} from '../types/preference.types.js';
@Injectable()
export class GetNodiaAiPreferenceOptionsUseCase {
  constructor(
    private readonly store: NodiaAiPreferenceService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  async execute(identity: NodiaAiActorReference, raw: unknown) {
    const query = validateNodiaAiDto(NodiaAiPreferenceOptionsDto, raw),
      definition = preferenceDefinition(query.scope_key, query.key),
      limit = query.page_limit ?? 20;
    if (
      limit > 50 ||
      (query.search !== undefined &&
        (!query.search.trim() || Buffer.byteLength(query.search) > 128)) ||
      (definition.requires_business_scope
        ? !query.business_id
        : query.business_id !== undefined) ||
      (query.for_supplier_scope !== undefined &&
        (query.scope_key !== 'business' || query.key !== 'business_id'))
    )
      return preferenceInvalid();
    return this.store.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(
        identity,
        { moduleRoutes: [definition.route] },
        manager,
      );
      const scope = cursorScope({
          actor: actor.actorId,
          session: actor.sessionId,
          scope: query.scope_key,
          key: query.key,
          business: query.business_id ?? null,
          search: query.search ?? null,
          supplier_scope: query.for_supplier_scope ?? false,
        }),
        after = decodeCursor(query.cursor, scope);
      if (
        after &&
        (after.length !== 1 ||
          (definition.value_type === 'uuid'
            ? !isUUID(after[0], '4')
            : !/^[1-9][0-9]{0,18}$/.test(after[0]) ||
              BigInt(after[0]) > 9223372036854775807n))
      )
        throw new BadRequestException('nodia_ai:invalid_cursor');
      const select =
        query.scope_key === 'finance'
          ? `SELECT f.id::text id,f.name label FROM finance_categories f WHERE f.is_active AND (f.user_id=$1 OR $2)`
          : query.key === 'business_id'
            ? query.for_supplier_scope === true
              ? `SELECT b.id::text id,b.name label FROM businesses b WHERE b.is_active AND EXISTS(SELECT 1 FROM providers p WHERE p.business_id=b.id AND p.is_active)`
              : `SELECT b.id::text id,b.name label FROM businesses b WHERE b.is_active AND (b.owner_id=$1 OR $2 OR EXISTS(SELECT 1 FROM business_collaborators bc WHERE bc.business_id=b.id AND bc.user_id=$1 AND bc.is_active))`
            : query.key === 'supplier_id'
              ? `SELECT p.id::text id,p.name label FROM providers p JOIN businesses b ON b.id=p.business_id AND b.is_active WHERE p.is_active AND p.business_id=$3::uuid`
              : `SELECT r.id::text id,r.name label FROM rental_properties r WHERE r.is_active AND (r.owner_id=$1 OR $2 OR EXISTS(SELECT 1 FROM rental_collaborators rc WHERE rc.property_id=r.id AND rc.user_id=$1 AND rc.is_active))`;
      const rows: { id: string; label: string }[] = await manager.query(
        `WITH parameters AS (SELECT $1::bigint actor,$2::boolean super,$3::uuid business),options AS (${select}) SELECT id,label FROM options WHERE ($4::text IS NULL OR strpos(lower(label),lower($4))>0) AND ($5::text IS NULL OR id>$5) ORDER BY id LIMIT $6`,
        [
          actor.actorId,
          actor.isSuperAdmin,
          query.business_id ?? null,
          query.search ?? null,
          after?.[0] ?? null,
          limit + 1,
        ],
      );
      const items = rows.slice(0, limit),
        last = items.at(-1);
      return {
        items,
        next_cursor:
          rows.length > limit && last ? encodeCursor(scope, [last.id]) : null,
      };
    });
  }
}
