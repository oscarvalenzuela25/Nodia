import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Module } from '../entities/module.entity.js';
import { UserModule } from '../../user/entities/user-module.entity.js';
import { Translation } from '../../translation/entities/translation.entity.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';

@Injectable()
export class DeleteModuleUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async execute(id: string): Promise<void> {
    validateCatalogId(id);
    await this.dataSource.transaction(async (manager) => {
      const module = await manager.findOne(Module, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!module) throw new NotFoundException('modules:not_found');
      // Assignments and translations belong to the deleted catalog entry.
      await manager.delete(UserModule, { module_id: id });
      await manager.delete(Translation, {
        source_entity: 'modules',
        source_id: id,
      });
      await manager.delete(Module, { id });
    });
    await this.redis.delByPattern('auth:context:*');
  }
}
