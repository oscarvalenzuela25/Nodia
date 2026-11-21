import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import { VisitNotificationsService } from '../visit-notifications.service.js';

@Injectable()
export class BusinessVisitPreferenceUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly settings: VisitNotificationsService,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  execute(businessId: string, actor: ActorReference, enabled?: boolean) {
    return this.source.transaction(async (manager) => {
      const { userId } = await assertBusinessesAccess(
        manager,
        actor,
        [businessId],
        { lock: true },
      );
      await this.modules.execute(userId, ['/business'], manager);
      if (
        !(await this.settings.isExplicitActiveMember(
          manager,
          businessId,
          userId,
        ))
      )
        throw new NotFoundException('business:resource_not_found');
      if (enabled === undefined)
        return {
          enabled: await this.settings.preference(manager, businessId, userId),
        };
      await this.settings.savePreference(manager, businessId, userId, enabled);
      return { enabled };
    });
  }
}
