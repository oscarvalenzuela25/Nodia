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

  async execute(id: string): Promise<void> {
    validateCatalogId(id, 'actions:invalid_id');
    await this.dataSource.transaction(async (manager) => {
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
    });
    await this.redis.delByPattern('auth:context:*');
  }
}
