import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';
import { UserRole } from './entities/user-role.entity.js';
import { UserModule as UserModuleEntity } from './entities/user-module.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetUsersDto } from './dto/get-users.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetUsersResponse } from './types/user.types.js';

import { TranslationService } from '../translation/translation.service.js';
import { RedisService } from '../common/redis/redis.service.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserModuleEntity)
    private readonly userModuleRepository: Repository<UserModuleEntity>,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async findAll({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetUsersDto): Promise<GetUsersResponse> {
    const qb = this.userRepository.createQueryBuilder('user');

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
        qb.andWhere('user_roles.role_id = :roleIdEq', { roleIdEq: q.roles_id_eq });
      }
      if (q.roles_id_in) {
        const inValues = Array.isArray(q.roles_id_in) ? q.roles_id_in : [q.roles_id_in];
        qb.andWhere('user_roles.role_id IN (:...roleIdIn)', { roleIdIn: inValues });
      }
    }

    if (q?.modules_id_eq || q?.modules_id_in) {
      if (!includes) {
        qb.leftJoin('user.user_modules', 'user_modules');
      }
      if (q.modules_id_eq) {
        qb.andWhere('user_modules.module_id = :moduleIdEq', { moduleIdEq: q.modules_id_eq });
      }
      if (q.modules_id_in) {
        const inValues = Array.isArray(q.modules_id_in) ? q.modules_id_in : [q.modules_id_in];
        qb.andWhere('user_modules.module_id IN (:...moduleIdIn)', { moduleIdIn: inValues });
      }
    }

    const {
      roles_id_eq: _req,
      roles_id_in: _rin,
      modules_id_eq: _meq,
      modules_id_in: _min,
      ...cleanQ
    } = q ?? {};
    applyRansack(qb, cleanQ, 'user');

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
          const translatedModules = await this.translationService.attachTranslations(
            'modules',
            Array.from(allModulesMap.values()),
          );
          translatedModulesMap = new Map(
            translatedModules.map((m) => [String(m.id), m]),
          );
        }

        if (allRolesMap.size > 0) {
          const translatedRoles = await this.translationService.attachTranslations(
            'roles',
            Array.from(allRolesMap.values()),
          );
          translatedRolesMap = new Map(
            translatedRoles.map((r) => [String(r.id), r]),
          );
        }
      }

      return users.map((user) => {
        const roles = user.user_roles
          ?.map((ur) => (ur.role ? (translatedRolesMap.get(String(ur.role.id)) ?? ur.role) : null))
          .filter(Boolean) ?? [];
        const modules = user.user_modules
          ?.map((um) => (um.module ? (translatedModulesMap.get(String(um.module.id)) ?? um.module) : null))
          .filter(Boolean) ?? [];
        const { user_roles: _user_roles, user_modules: _user_modules, ...rest } = user;
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

  async create(createUserDto: CreateUserDto) {
    const normalizedEmail = createUserDto.email?.toLowerCase().trim();
    if (normalizedEmail) {
      const existing = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return this.update(existing.id, createUserDto);
      }
    }

    const { roles, modules, ...userData } = createUserDto;
    const newUser = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(newUser);

    if (roles && roles.length > 0) {
      const userRoles = roles.map((roleId) =>
        this.userRoleRepository.create({
          user_id: savedUser.id,
          role_id: roleId,
          is_active: true,
        }),
      );
      await this.userRoleRepository.save(userRoles);
    }

    if (modules && modules.length > 0) {
      const userModules = modules.map((moduleId) =>
        this.userModuleRepository.create({
          user_id: savedUser.id,
          module_id: moduleId,
          is_active: true,
        }),
      );
      await this.userModuleRepository.save(userModules);
    }

    if (savedUser.email) {
      await this.redisService.del(`auth:context:${savedUser.email.toLowerCase().trim()}`);
    }

    return this.findOne(savedUser.id);
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
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
    let modules = user.user_modules?.map((um) => um.module).filter(Boolean) ?? [];

    if (modules.length > 0) {
      modules = (await this.translationService.attachTranslations(
        'modules',
        modules,
      )) as any;
    }
    if (roles.length > 0) {
      roles = (await this.translationService.attachTranslations(
        'roles',
        roles,
      )) as any;
    }

    const { user_roles: _user_roles, user_modules: _user_modules, ...rest } = user;
    return {
      ...rest,
      roles,
      modules,
    } as User;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const { roles, modules, ...rest } = updateUserDto;
    Object.assign(user, rest);
    await this.userRepository.save(user);

    if (roles !== undefined) {
      await this.userRoleRepository.delete({ user_id: id });
      if (roles.length > 0) {
        const userRoles = roles.map((roleId) =>
          this.userRoleRepository.create({
            user_id: id,
            role_id: roleId,
            is_active: true,
          }),
        );
        await this.userRoleRepository.save(userRoles);
      }
    }

    if (modules !== undefined) {
      await this.userModuleRepository.delete({ user_id: id });
      if (modules.length > 0) {
        const userModules = modules.map((moduleId) =>
          this.userModuleRepository.create({
            user_id: id,
            module_id: moduleId,
            is_active: true,
          }),
        );
        await this.userModuleRepository.save(userModules);
      }
    }

    if (user.email) {
      await this.redisService.del(`auth:context:${user.email.toLowerCase().trim()}`);
    }
    if (
      updateUserDto.email &&
      updateUserDto.email.toLowerCase().trim() !== user.email?.toLowerCase().trim()
    ) {
      await this.redisService.del(
        `auth:context:${updateUserDto.email.toLowerCase().trim()}`,
      );
    }

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
