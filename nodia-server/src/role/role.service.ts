import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Action } from '../action/entities/action.entity.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetRolesDto } from './dto/get-roles.dto.js';
import { RoleAction } from './entities/role-action.entity.js';
import { Role } from './entities/role.entity.js';
import { GetRolesResponse } from './types/role.types.js';

import { RedisService } from '../common/redis/redis.service.js';
import { TranslationService } from '../translation/translation.service.js';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RoleAction)
    _roleActionRepository: Repository<RoleAction>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, includes = true, q }: GetRolesDto,
    manager?: EntityManager,
  ): Promise<GetRolesResponse> {
    const qb = (
      manager?.getRepository(Role) ?? this.roleRepository
    ).createQueryBuilder('role');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect(
        'role.role_actions',
        'role_actions',
      ).leftJoinAndSelect('role_actions.action', 'action');
    }

    if (
      q?.actions_id_eq ||
      q?.actions_id_in?.length ||
      q?.actions_key_in?.length ||
      q?.actions_key_cont
    ) {
      // Filter the role without narrowing the actions included in its response.
      const conditions = ['role_filter.role_id = role.id'];
      const parameters: Record<string, unknown> = {};
      if (q.actions_id_eq) {
        conditions.push('role_filter.action_id = :actionIdEq');
        parameters.actionIdEq = q.actions_id_eq;
      }
      if (q.actions_id_in?.length) {
        conditions.push('role_filter.action_id IN (:...actionIdIn)');
        parameters.actionIdIn = q.actions_id_in;
      }
      if (q.actions_key_in?.length) {
        conditions.push('action_filter.key IN (:...actionKeyIn)');
        parameters.actionKeyIn = q.actions_key_in;
      }
      if (q.actions_key_cont) {
        conditions.push('action_filter.key ILIKE :actionKeyCont');
        parameters.actionKeyCont = `%${q.actions_key_cont}%`;
      }
      qb.andWhere(
        `EXISTS (SELECT 1 FROM role_actions role_filter JOIN actions action_filter ON action_filter.id = role_filter.action_id WHERE ${conditions.join(' AND ')})`,
        parameters,
      );
    }

    const {
      actions_id_eq: _aie,
      actions_id_in: _aii,
      actions_key_cont: _akc,
      actions_key_in: _aki,
      ...cleanRoleQ
    } = q ?? {};
    applyRansack(qb, cleanRoleQ, 'role', RANSACK_POLICIES.role);
    if (manager && !/^id\s/i.test(String(q?.s ?? '')))
      qb.addOrderBy('role.id', 'ASC');

    const attachActionTranslations = async (
      rolesList: Role[],
    ): Promise<Map<string, any>> => {
      if (!includes) return new Map();
      const allActions: Action[] = [];
      for (const r of rolesList) {
        if (r.role_actions) {
          for (const ra of r.role_actions) {
            if (ra.action) {
              allActions.push(ra.action);
            }
          }
        }
      }
      if (allActions.length === 0) return new Map();

      const uniqueActionsMap = new Map<string, Action>();
      for (const act of allActions) {
        if (act.id && !uniqueActionsMap.has(String(act.id))) {
          uniqueActionsMap.set(String(act.id), act);
        }
      }

      const translatedActions =
        await this.translationService.attachTranslations(
          'actions',
          Array.from(uniqueActionsMap.values()),
          manager,
        );

      const map = new Map<string, any>();
      for (const ta of translatedActions) {
        map.set(String(ta.id), ta);
      }
      return map;
    };

    const formatRole = (
      role: Role,
      actionTranslationsMap?: Map<string, any>,
    ): Role => {
      const actions =
        role.role_actions
          ?.map((ra) => {
            if (!ra.action) return null;
            return (
              actionTranslationsMap?.get(String(ra.action.id)) ?? ra.action
            );
          })
          .filter(Boolean) ?? [];
      const { role_actions: _ra, role_users: _ru, ...rest } = role;
      return {
        ...rest,
        actions: includes ? actions : [],
      } as Role;
    };

    if (all) {
      const rawData = await qb.getMany();
      const actionTranslationsMap = await attachActionTranslations(rawData);
      const data = await this.translationService.attachTranslations(
        'roles',
        rawData.map((r) => formatRole(r, actionTranslationsMap)),
        manager,
      );
      return {
        data: data as any,
        meta: {
          page: 1,
          limit: data.length,
          total_items: data.length,
          total_pages: 1,
        },
      };
    }

    const [rawData, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const actionTranslationsMap = await attachActionTranslations(rawData);
    const data = await this.translationService.attachTranslations(
      'roles',
      rawData.map((r) => formatRole(r, actionTranslationsMap)),
      manager,
    );
    const total_pages = Math.ceil(total_items / limit);

    return {
      data: data as any,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string, manager?: EntityManager): Promise<Role> {
    const role = await (
      manager?.getRepository(Role) ?? this.roleRepository
    ).findOne({
      where: { id },
      relations: {
        role_actions: {
          action: true,
        },
      },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }
    const rawActions =
      role.role_actions?.map((ra) => ra.action).filter(Boolean) ?? [];
    const actions = await this.translationService.attachTranslations(
      'actions',
      rawActions,
      manager,
    );
    const { role_actions: _ra, role_users: _ru, ...rest } = role;
    const formatted = {
      ...rest,
      actions,
    } as Role;

    return this.translationService.attachTranslationsToOne(
      'roles',
      formatted,
      manager,
    ) as any;
  }
}
