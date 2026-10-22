import { Injectable } from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import { NODIA_AI_PREFERENCE_CATALOG } from '../types/preference.types.js';
@Injectable()
export class GetNodiaAiPreferenceCatalogUseCase {
  constructor(
    private readonly store: NodiaAiPreferenceService,
    private readonly authorize: AuthorizeNodiaAiUseCase,
  ) {}
  execute(identity: NodiaAiActorReference) {
    return this.store.transaction(async (manager) => {
      await lockAuthority(manager);
      const actor = await this.authorize.execute(identity, {}, manager);
      return {
        items: NODIA_AI_PREFERENCE_CATALOG.filter((item) =>
          actor.modules.some((module) => module.route === item.route),
        ).map(({ route: _route, ...item }) => item),
      };
    });
  }
}
