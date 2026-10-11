import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity.js';
import { RoleAction } from '../entities/role-action.entity.js';
import { UserRole } from '../../user/entities/user-role.entity.js';
import { Translation } from '../../translation/entities/translation.entity.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async execute(id: string): Promise<void> {
    validateCatalogId(id, 'roles:invalid_id');
    await this.dataSource.transaction(async (manager) => {
      const role = await manager.findOne(Role, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!role) throw new NotFoundException('roles:not_found');
      if (role.key === 'super_admin')
        throw new ForbiddenException('roles:protected_role');
      await manager.delete(UserRole, { role_id: id });
      await manager.delete(RoleAction, { role_id: id });
      await manager.delete(Translation, {
        source_entity: 'roles',
        source_id: id,
      });
      await manager.delete(Role, { id });
    });
    await this.redis.delByPattern('auth:context:*');
  }
}
