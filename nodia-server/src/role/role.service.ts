import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Role } from './entities/role.entity.js';
import { RoleAction } from './entities/role-action.entity.js';
import { Action } from '../action/entities/action.entity.js';
import { GetRolesDto } from './dto/get-roles.dto.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetRolesResponse } from './types/role.types.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

import { TranslationService } from '../translation/translation.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(RoleAction)
    private readonly roleActionRepository: Repository<RoleAction>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetRolesDto): Promise<GetRolesResponse> {
    const qb = this.roleRepository.createQueryBuilder('role');
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

  private async resolveActionIds(
    actions: string[],
    manager?: EntityManager,
  ): Promise<string[]> {
    if (!actions || actions.length === 0) return [];

    const numericIds = actions.filter((a) => /^\d+$/.test(a));
    const keys = actions.filter((a) => !/^\d+$/.test(a));

    const qb = (
      manager?.getRepository(Action) ?? this.actionRepository
    ).createQueryBuilder('action');
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
      for (const entity of actionEntities) {
        idMap.set(entity.key, entity.id);
        idMap.set(entity.id, entity.id);
      }
      return actions
        .map((act) => idMap.get(act) ?? act)
        .filter((id) => /^\d+$/.test(id));
    }

    return actions.filter((id) => /^\d+$/.test(id));
  }

  async create(createRoleDto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepository.findOne({
      where: { key: createRoleDto.key },
    });
    if (existing) {
      return this.update(existing.id, createRoleDto);
    }

    const { actions, translates, ...roleData } = createRoleDto;
    const newRole = this.roleRepository.create(roleData);
    const savedRole = await this.roleRepository.save(newRole);

    if (actions && actions.length > 0) {
      const resolvedIds = await this.resolveActionIds(actions);
      const roleActions = resolvedIds.map((actionId) =>
        this.roleActionRepository.create({
          role_id: savedRole.id,
          action_id: actionId,
          is_active: true,
        }),
      );
      await this.roleActionRepository.save(roleActions);
    }

    if (translates && translates.length > 0) {
      await this.translationService.saveTranslations(
        'roles',
        savedRole.id,
        translates,
      );
    }

    await this.redisService.delByPattern('auth:context:*');

    return this.findOne(savedRole.id);
  }

  async findOne(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
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
    );
    const { role_actions: _ra, role_users: _ru, ...rest } = role;
    const formatted = {
      ...rest,
      actions,
    } as Role;

    return this.translationService.attachTranslationsToOne(
      'roles',
      formatted,
    ) as any;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
    await this.roleRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Role);
      const role = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!role) throw new NotFoundException('roles:not_found');
      // The reserved key must stay reserved, even when this update races a deletion.
      if (
        role.key === 'super_admin' &&
        updateRoleDto.key !== undefined &&
        updateRoleDto.key !== role.key
      ) {
        throw new ForbiddenException('roles:protected_key');
      }
      const { actions, translates, ...rest } = updateRoleDto;
      Object.assign(role, rest);
      await repository.save(role);
      if (actions !== undefined) {
        const assignments = manager.getRepository(RoleAction);
        await assignments.delete({ role_id: id });
        if (actions.length > 0) {
          const resolvedIds = await this.resolveActionIds(actions, manager);
          await assignments.save(
            resolvedIds.map((actionId) =>
              assignments.create({
                role_id: id,
                action_id: actionId,
                is_active: true,
              }),
            ),
          );
        }
      }
      if (translates !== undefined) {
        await this.translationService.updateTranslations(
          'roles',
          id,
          translates,
          manager,
        );
      }
    });
    await this.redisService.delByPattern('auth:context:*');
    return this.findOne(id);
  }
}
