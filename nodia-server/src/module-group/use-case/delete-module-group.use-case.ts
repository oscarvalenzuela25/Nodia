import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ModuleGroup } from '../entities/module-group.entity.js';
import { Module } from '../../module/entities/module.entity.js';
import { Translation } from '../../translation/entities/translation.entity.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';

@Injectable()
export class DeleteModuleGroupUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async execute(id: string, actor: ActorReference): Promise<void> {
    validateCatalogId(id);
    await runCoreAuthorityTransaction(
      this.dataSource,
      actor,
      async (manager) => {
        // The parent lock also serializes concurrent associations through their FK.
        const group = await manager.findOne(ModuleGroup, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!group) throw new NotFoundException('modules:groups.not_found');
        if (await manager.exists(Module, { where: { module_group_id: id } })) {
          throw new ConflictException('modules:groups.delete_has_modules');
        }
        await manager.delete(Translation, {
          source_entity: 'module_groups',
          source_id: id,
        });
        await manager.delete(ModuleGroup, { id });
      },
    );
    if (!actor.transaction) await this.redis.delByPattern('auth:context:*');
  }
}
