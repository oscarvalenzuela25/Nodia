import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Action } from '../entities/action.entity.js';
import { RoleAction } from '../../role/entities/role-action.entity.js';
import { Translation } from '../../translation/entities/translation.entity.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';

@Injectable()
export class DeleteActionUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async execute(id: string, actor: ActorReference): Promise<void> {
    validateCatalogId(id, 'actions:invalid_id');
    await runCoreAuthorityTransaction(
      this.dataSource,
      actor,
      async (manager) => {
        const action = await manager.findOne(Action, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!action) throw new NotFoundException('actions:not_found');
        await manager.delete(RoleAction, { action_id: id });
        await manager.delete(Translation, {
          source_entity: 'actions',
          source_id: id,
        });
        await manager.delete(Action, { id });
      },
    );
    if (!actor.transaction) await this.redis.delByPattern('auth:context:*');
  }
}
