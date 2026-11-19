import { ForbiddenException, GoneException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  currentActor,
  lockAuthority,
  type ActorReference,
} from '../../authorization/authority-transaction.js';

@Injectable()
export class RefreshNewsUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(actor: ActorReference): Promise<never> {
    return this.dataSource.transaction(async (manager) => {
      await lockAuthority(manager);
      const authority = await currentActor(manager, actor);
      if (!authority.isSuperAdmin)
        throw new ForbiddenException('news:super_admin_required');
      throw new GoneException('news:source_retired');
    });
  }
}
