import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import { GetUsersDto } from './dto/get-users.dto.js';
import { UserModule as UserModuleEntity } from './entities/user-module.entity.js';
import { UserRole } from './entities/user-role.entity.js';
import { User } from './entities/user.entity.js';
import { GetUsersResponse } from './types/user.types.js';

import { RedisService } from '../common/redis/redis.service.js';
import { TranslationService } from '../translation/translation.service.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    _userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserModuleEntity)
    _userModuleRepository: Repository<UserModuleEntity>,
    private readonly translationService: TranslationService,
    _redisService: RedisService,
  ) {}

  async findAll(
    { page = 1, limit = 10, all = false, includes = true, q }: GetUsersDto,
    manager?: EntityManager,
  ): Promise<GetUsersResponse> {
    const qb = (
      manager?.getRepository(User) ?? this.userRepository
    ).createQueryBuilder('user');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('user.user_roles', 'user_roles')
        .leftJoinAndSelect('user_roles.role', 'role')
        .leftJoinAndSelect('user.user_modules', 'user_modules')
        .leftJoinAndSelect('user_modules.module', 'module');
    }

    if (q?.roles_id_eq || q?.roles_id_in) {
      if (!includes) {
        qb.leftJoin('user.user_roles', 'user_roles');
      }
      if (q.roles_id_eq) {
        qb.andWhere('user_roles.role_id = :roleIdEq', {
          roleIdEq: q.roles_id_eq,
        });
      }
      if (q.roles_id_in) {
        const inValues = Array.isArray(q.roles_id_in)
          ? q.roles_id_in
          : [q.roles_id_in];
        qb.andWhere('user_roles.role_id IN (:...roleIdIn)', {
          roleIdIn: inValues,
        });
      }
    }

    if (q?.modules_id_eq || q?.modules_id_in) {
      if (!includes) {
        qb.leftJoin('user.user_modules', 'user_modules');
      }
      if (q.modules_id_eq) {
        qb.andWhere('user_modules.module_id = :moduleIdEq', {
          moduleIdEq: q.modules_id_eq,
        });
      }
      if (q.modules_id_in) {
        const inValues = Array.isArray(q.modules_id_in)
          ? q.modules_id_in
          : [q.modules_id_in];
        qb.andWhere('user_modules.module_id IN (:...moduleIdIn)', {
          moduleIdIn: inValues,
        });
      }
    }

    const {
      roles_id_eq: _req,
      roles_id_in: _rin,
      modules_id_eq: _meq,
      modules_id_in: _min,
      ...cleanQ
    } = q ?? {};
    applyRansack(qb, cleanQ, 'user', RANSACK_POLICIES.user);
    if (manager && !/^id\s/i.test(String(q?.s ?? '')))
      qb.addOrderBy('user.id', 'ASC');

    const formatUsers = async (users: User[]): Promise<User[]> => {
      let translatedModulesMap = new Map<string, any>();
      let translatedRolesMap = new Map<string, any>();

      if (includes) {
        const allModulesMap = new Map<string, any>();
        const allRolesMap = new Map<string, any>();
        for (const user of users) {
          for (const um of user.user_modules ?? []) {
            if (um.module) allModulesMap.set(String(um.module.id), um.module);
          }
          for (const ur of user.user_roles ?? []) {
            if (ur.role) allRolesMap.set(String(ur.role.id), ur.role);
          }
        }

        if (allModulesMap.size > 0) {
          const translatedModules =
            await this.translationService.attachTranslations(
              'modules',
              Array.from(allModulesMap.values()),
              manager,
            );
          translatedModulesMap = new Map(
            translatedModules.map((m) => [String(m.id), m]),
          );
        }

        if (allRolesMap.size > 0) {
          const translatedRoles =
            await this.translationService.attachTranslations(
              'roles',
              Array.from(allRolesMap.values()),
              manager,
            );
          translatedRolesMap = new Map(
            translatedRoles.map((r) => [String(r.id), r]),
          );
        }
      }

      return users.map((user) => {
        const roles =
          user.user_roles
            ?.map((ur) =>
              ur.role
                ? (translatedRolesMap.get(String(ur.role.id)) ?? ur.role)
                : null,
            )
            .filter(Boolean) ?? [];
        const modules =
          user.user_modules
            ?.map((um) =>
              um.module
                ? (translatedModulesMap.get(String(um.module.id)) ?? um.module)
                : null,
            )
            .filter(Boolean) ?? [];
        const {
          user_roles: _user_roles,
          user_modules: _user_modules,
          ...rest
        } = user;
        return {
          ...rest,
          roles: includes ? roles : [],
          modules: includes ? modules : [],
        } as User;
      });
    };

    if (all) {
      const rawData = await qb.getMany();
      const data = await formatUsers(rawData);

      return {
        data,
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

    const data = await formatUsers(rawData);
    const total_pages = Math.ceil(total_items / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOne(id: string, manager?: EntityManager) {
    const user = await (
      manager?.getRepository(User) ?? this.userRepository
    ).findOne({
      where: { id },
      relations: {
        user_roles: {
          role: true,
        },
        user_modules: {
          module: true,
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    let roles = user.user_roles?.map((ur) => ur.role).filter(Boolean) ?? [];
    let modules =
      user.user_modules?.map((um) => um.module).filter(Boolean) ?? [];

    if (modules.length > 0) {
      modules = (await this.translationService.attachTranslations(
        'modules',
        modules,
        manager,
      )) as any;
    }
    if (roles.length > 0) {
      roles = (await this.translationService.attachTranslations(
        'roles',
        roles,
        manager,
      )) as any;
    }

    const {
      user_roles: _user_roles,
      user_modules: _user_modules,
      ...rest
    } = user;
    return {
      ...rest,
      roles,
      modules,
    } as User;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
