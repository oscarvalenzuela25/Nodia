import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';
import { UserRole } from './entities/user-role.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetUsersDto } from './dto/get-users.dto.js';
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetUsersResponse } from './types/user.types.js';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
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
        .leftJoinAndSelect('user_roles.role', 'role');
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

    const { roles_id_eq: _req, roles_id_in: _rin, ...cleanQ } = q ?? {};
    applyRansack(qb, cleanQ, 'user');

    const formatUser = (user: User): User => {
      const roles = user.user_roles
        ?.map((ur) => ur.role)
        .filter(Boolean) ?? [];
      const { user_roles: _user_roles, ...rest } = user;
      return {
        ...rest,
        roles: includes ? roles : [],
      } as User;
    };

    if (all) {
      const rawData = await qb.getMany();
      const data = rawData.map(formatUser);

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

    const data = rawData.map(formatUser);
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
    const { roles, ...userData } = createUserDto;
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

    return this.findOne(savedUser.id);
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        user_roles: {
          role: true,
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    const roles = user.user_roles?.map((ur) => ur.role).filter(Boolean) ?? [];
    const { user_roles: _user_roles, ...rest } = user;
    return {
      ...rest,
      roles,
    } as User;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const { roles, ...rest } = updateUserDto;
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

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
