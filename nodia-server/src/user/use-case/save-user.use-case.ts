import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { User } from '../entities/user.entity.js';
import { UserService } from '../user.service.js';

import { validateCatalogId } from '../../common/dto/catalog-id.dto.js';
import { Module } from '../../module/entities/module.entity.js';
import { Role } from '../../role/entities/role.entity.js';
import { UserModule as UserModuleEntity } from '../entities/user-module.entity.js';
import { UserRole } from '../entities/user-role.entity.js';
import {
  activeSuperAdminCount,
  preserveSuperAdmin,
} from './user-authority.rules.js';

@Injectable()
export class SaveUserUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly reader: UserService,
    private readonly redisService: RedisService,
  ) {}
  async execute(
    id: string | undefined,
    dto: UpdateUserDto,
    actor: ActorReference,
  ) {
    const result = await runCoreAuthorityTransaction(
      this.source,
      actor,
      async (manager) => {
        const previousAdmins = await activeSuperAdminCount(manager);
        const repository = manager.getRepository(User);
        if (dto.email !== undefined && typeof dto.email !== 'string')
          throw new BadRequestException('core:invalid_input');
        const normalizedEmail = dto.email?.trim().toLowerCase();
        let user = id
          ? await repository.findOneBy({ id })
          : normalizedEmail
            ? await repository.findOneBy({ email: normalizedEmail })
            : null;
        if (id && !user) throw new NotFoundException('users:not_found');
        const oldEmail = user?.email;
        const { roles, modules, ...fields } = dto;
        for (const values of [roles, modules])
          if (values !== undefined) {
            if (!Array.isArray(values) || values.length > 100)
              throw new BadRequestException('users:invalid_associations');
            for (const value of values)
              validateCatalogId(value, 'users:invalid_associations');
          }
        user = repository.create({
          ...user,
          ...fields,
          ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        });
        if (dto.is_active !== undefined && typeof dto.is_active !== 'boolean')
          throw new BadRequestException('core:invalid_input');
        const saved = await repository.save(user);
        for (const [target, values, column] of [
          [UserRole, roles, 'role_id'],
          [UserModuleEntity, modules, 'module_id'],
        ] as const) {
          if (values === undefined) continue;
          const expected = [...new Set(values)];
          const catalog = target === UserRole ? Role : Module;
          const found = await manager
            .getRepository(catalog)
            .find({ where: { id: In(expected) }, select: { id: true } });
          if (found.length !== expected.length)
            throw new BadRequestException('users:invalid_associations');
          const assignments = manager.getRepository(target);
          await assignments.delete({ user_id: saved.id });
          if (values.length)
            await assignments.insert(
              [...new Set(values)].map((value) => ({
                user_id: saved.id,
                [column]: value,
                is_active: true,
              })),
            );
        }
        await preserveSuperAdmin(manager, previousAdmins);
        return { id: saved.id, oldEmail, email: saved.email };
      },
    );
    if (actor.transaction)
      return actor.transaction
        .getRepository(User)
        .findOneByOrFail({ id: result.id });
    for (const email of new Set([result.oldEmail, result.email]))
      if (email)
        await this.redisService.del(
          'auth:context:' + email.trim().toLowerCase(),
        );
    return this.reader.findOne(result.id);
  }
}
