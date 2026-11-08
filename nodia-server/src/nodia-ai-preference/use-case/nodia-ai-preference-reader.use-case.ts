import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import type { EntityManager } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type {
  NodiaAiActorReference,
  NodiaAiAuthorizedActor,
} from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import {
  NODIA_AI_PREFERENCE_LIMIT,
  preferenceScopeHash,
  validatePreferenceValue,
  type NodiaAiContextPreference,
} from '../types/preference.types.js';
import type { NodiaAiPreference } from '../entities/nodia-ai-preference.entity.js';

@Injectable()
export class NodiaAiPreferenceReaderUseCase {
  constructor(
    private readonly store: NodiaAiPreferenceService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  async project(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    rows: readonly NodiaAiPreference[],
    routes: readonly string[],
  ) {
    if (rows.length > NODIA_AI_PREFERENCE_LIMIT)
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    for (const row of rows) {
      try {
        validatePreferenceValue({
          scope_key: row.scope_key,
          scope: row.scope,
          key: row.key,
          value: row.value,
        });
      } catch {
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      }
      if (
        row.owner_id !== actor.actorId ||
        row.scope_hash !== preferenceScopeHash(row.scope_key, row.scope)
      )
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
    }
    const references = new Map(
      (await this.store.references(manager, actor, routes, rows)).map(
        (item) => [item.id, item],
      ),
    );
    return rows.map((row) => {
      const reference = references.get(row.id);
      return {
        preference_id: row.id,
        scope_key: row.scope_key,
        scope: row.scope,
        key: row.key,
        value: row.value,
        revision: row.revision,
        value_label: reference?.value_label ?? null,
        scope_label: reference?.scope_label ?? null,
        available: typeof reference?.value_label === 'string',
      };
    });
  }
  async loadForContext(
    manager: EntityManager,
    identity: NodiaAiActorReference,
    routes: readonly string[],
  ): Promise<readonly NodiaAiContextPreference[]> {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException(
        'authorization:transaction_required',
      );
    await lockAuthority(manager);
    const actor = await this.authorize.execute(identity, {}, manager);
    await this.store.lockOwner(manager, actor.actorId);
    const allowed = actor.modules
      .map((module) => module.route)
      .filter((route) => moduleRouteIncluded(routes, route));
    const projected = await this.project(
      manager,
      actor,
      await this.store.list(manager, actor.actorId),
      allowed,
    );
    return projected.flatMap((item) =>
      item.available && item.value_label !== null
        ? [
            {
              id: item.preference_id,
              scope_key: item.scope_key,
              scope: item.scope,
              key: item.key,
              value: item.value,
              revision: item.revision,
              value_label: item.value_label,
              scope_label: item.scope_label,
            },
          ]
        : [],
    );
  }
}
