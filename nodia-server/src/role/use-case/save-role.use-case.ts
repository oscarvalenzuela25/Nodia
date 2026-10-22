import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { type ActorReference } from '../../authorization/authority-transaction.js';
import { runCoreAuthorityTransaction } from '../../authorization/core-authority-transaction.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { TranslationService } from '../../translation/translation.service.js';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { Role } from '../entities/role.entity.js';
import { RoleService } from '../role.service.js';

import { Action } from '../../action/entities/action.entity.js';
import { RoleAction } from '../entities/role-action.entity.js';
@Injectable()
export class SaveRoleUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly reader: RoleService,
    private readonly redisService: RedisService,
    private readonly translationService: TranslationService,
  ) {}
  async execute(
    id: string | undefined,
    dto: UpdateRoleDto,
    actor: ActorReference,
  ): Promise<Role> {
    const savedId = await runCoreAuthorityTransaction(
      this.source,
      actor,
      async (manager) => {
        const repository = manager.getRepository(Role);
        const existing = id
          ? await repository.findOneBy({ id })
          : dto.key
            ? await repository.findOneBy({ key: dto.key })
            : null;
        if (id && !existing) throw new NotFoundException('roles:not_found');
        if (!existing && dto.key === 'super_admin')
          throw new ForbiddenException('roles:protected_role');
        if (
          existing?.key === 'super_admin' &&
          dto.key !== undefined &&
          dto.key !== existing.key
        )
          throw new ForbiddenException('roles:protected_key');
        if (existing?.key === 'super_admin' && dto.is_active === false)
          throw new ForbiddenException('roles:protected_role');
        const { translates, actions, ...fields } = dto;
        const saved = await repository.save(
          repository.create({ ...existing, ...fields }),
        );
        if (actions !== undefined) {
          const assignments = manager.getRepository(RoleAction);
          await assignments.delete({ role_id: saved.id });
          const ids = await this.resolveActionIds(actions, manager);
          if (ids.length)
            await assignments.insert(
              [...new Set(ids)].map((action_id) => ({
                role_id: saved.id,
                action_id,
                is_active: true,
              })),
            );
        }
        if (translates !== undefined)
          await this.translationService.updateTranslations(
            'roles',
            saved.id,
            translates,
            manager,
          );
        return saved.id;
      },
    );
    if (actor.transaction)
      return actor.transaction
        .getRepository(Role)
        .findOneByOrFail({ id: savedId });
    await this.redisService.delByPattern('auth:context:*');
    return this.reader.findOne(savedId);
  }
  private async resolveActionIds(
    actions: string[],
    manager: EntityManager,
  ): Promise<string[]> {
    if (!actions || actions.length === 0) return [];
    if (
      !Array.isArray(actions) ||
      actions.length > 100 ||
      actions.some(
        (value) =>
          typeof value !== 'string' ||
          value.length > 255 ||
          (/^\d+$/.test(value) && BigInt(value) > 9223372036854775807n),
      )
    )
      throw new BadRequestException('roles:invalid_actions');

    const numericIds = actions.filter((a) => /^\d+$/.test(a));
    const keys = actions.filter((a) => !/^\d+$/.test(a));

    const qb = manager.getRepository(Action).createQueryBuilder('action');
    if (keys.length > 0 && numericIds.length > 0) {
      qb.where('action.key IN (:...keys) OR action.id IN (:...numericIds)', {
        keys,
        numericIds,
      });
    } else if (keys.length > 0) {
      qb.where('action.key IN (:...keys)', { keys });
    } else if (numericIds.length > 0) {
      qb.where('action.id IN (:...numericIds)', { numericIds });
    } else {
      return [];
    }

    const actionEntities = await qb.getMany();

    if (actionEntities.length > 0) {
      const idMap = new Map<string, string>();
      const keyMap = new Map<string, string>();
      for (const entity of actionEntities) {
        keyMap.set(entity.key, entity.id);
        idMap.set(entity.id, entity.id);
      }
      const resolved = actions.map((act) =>
        /^\d+$/.test(act) ? idMap.get(act) : keyMap.get(act),
      );
      if (resolved.some((id) => id === undefined))
        throw new BadRequestException('roles:invalid_actions');
      return resolved as string[];
    }

    throw new BadRequestException('roles:invalid_actions');
  }
}
