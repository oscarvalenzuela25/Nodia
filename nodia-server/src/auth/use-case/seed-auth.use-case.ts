import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SeedAuthDto } from '../dto/seed-auth.dto.js';
import { envs } from '../../config/envs.config.js';
import { Role } from '../../role/entities/role.entity.js';
import { User } from '../../user/entities/user.entity.js';
import { UserRole } from '../../user/entities/user-role.entity.js';
import { UserModule } from '../../user/entities/user-module.entity.js';
import { ModuleGroup } from '../../module-group/entities/module-group.entity.js';
import { Module } from '../../module/entities/module.entity.js';
import { TranslationService } from '../../translation/translation.service.js';
import { RedisService } from '../../common/redis/redis.service.js';

@Injectable()
export class SeedAuthUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async execute(dto: SeedAuthDto) {
    // 1. Verify SECRET_SEED token
    if (!envs.SECRET_SEED || dto.secret_seed !== envs.SECRET_SEED) {
      throw new UnauthorizedException('Invalid secret seed');
    }

    // 2. Verify if a super_admin already exists
    const superAdminRole = await this.dataSource.getRepository(Role).findOne({
      where: { key: 'super_admin' },
    });

    if (superAdminRole) {
      const existingSuperAdmin = await this.dataSource
        .getRepository(UserRole)
        .findOne({
          where: { role_id: superAdminRole.id, is_active: true },
        });

      if (existingSuperAdmin) {
        throw new ConflictException('A super admin already exists');
      }
    }

    // 3. Seed database inside a transaction
    const result = await this.dataSource.transaction(async (manager) => {
      // 3.1 Role: super_admin
      let role = superAdminRole;
      if (!role) {
        role = manager.getRepository(Role).create({
          key: 'super_admin',
          is_active: true,
        });
        role = await manager.getRepository(Role).save(role);
      } else if (!role.is_active) {
        role.is_active = true;
        role = await manager.getRepository(Role).save(role);
      }

      await this.translationService.saveTranslations('roles', role.id, [
        {
          key: 'key',
          es: 'Super Administrador',
          en: 'Super Administrator',
        },
      ]);

      // 3.2 ModuleGroup: general_settings
      let moduleGroup = await manager.getRepository(ModuleGroup).findOne({
        where: { key: 'general_settings' },
      });
      if (!moduleGroup) {
        moduleGroup = manager.getRepository(ModuleGroup).create({
          key: 'general_settings',
          is_active: true,
        });
        moduleGroup = await manager.getRepository(ModuleGroup).save(moduleGroup);
      } else if (!moduleGroup.is_active) {
        moduleGroup.is_active = true;
        moduleGroup = await manager.getRepository(ModuleGroup).save(moduleGroup);
      }

      await this.translationService.saveTranslations(
        'module_groups',
        moduleGroup.id,
        [
          {
            key: 'key',
            es: 'Administrador General',
            en: 'General Administration',
          },
        ],
      );

      // 3.3 Modules
      const modulesData = [
        {
          key: 'users',
          link: '/settings/users',
          translates: [{ key: 'key', es: 'Usuarios', en: 'Users' }],
        },
        {
          key: 'roles',
          link: '/settings/roles',
          translates: [{ key: 'key', es: 'Roles', en: 'Roles' }],
        },
        {
          key: 'actions',
          link: '/settings/actions',
          translates: [{ key: 'key', es: 'Acciones', en: 'Actions' }],
        },
        {
          key: 'modules',
          link: '/settings/modules',
          translates: [{ key: 'key', es: 'Módulos', en: 'Modules' }],
        },
      ];

      const savedModules: Module[] = [];
      for (const item of modulesData) {
        let mod = await manager.getRepository(Module).findOne({
          where: { key: item.key },
        });

        if (!mod) {
          mod = manager.getRepository(Module).create({
            key: item.key,
            link: item.link,
            module_group_id: moduleGroup.id,
            is_active: true,
          });
          mod = await manager.getRepository(Module).save(mod);
        } else {
          mod.link = item.link;
          mod.module_group_id = moduleGroup.id;
          mod.is_active = true;
          mod = await manager.getRepository(Module).save(mod);
        }

        await this.translationService.saveTranslations(
          'modules',
          mod.id,
          item.translates,
        );
        savedModules.push(mod);
      }

      // 3.4 User: super_admin_email
      const normalizedEmail = dto.super_admin_email.toLowerCase().trim();
      let user = await manager.getRepository(User).findOne({
        where: { email: normalizedEmail },
      });

      if (!user) {
        user = manager.getRepository(User).create({
          email: normalizedEmail,
          name: 'Super Admin',
          is_active: true,
        });
        user = await manager.getRepository(User).save(user);
      } else if (!user.is_active) {
        user.is_active = true;
        user = await manager.getRepository(User).save(user);
      }

      // 3.5 Assign super_admin role to user
      let userRole = await manager.getRepository(UserRole).findOne({
        where: { user_id: user.id, role_id: role.id },
      });

      if (!userRole) {
        userRole = manager.getRepository(UserRole).create({
          user_id: user.id,
          role_id: role.id,
          is_active: true,
        });
        await manager.getRepository(UserRole).save(userRole);
      } else if (!userRole.is_active) {
        userRole.is_active = true;
        await manager.getRepository(UserRole).save(userRole);
      }

      // 3.6 Assign modules to user
      for (const mod of savedModules) {
        let userMod = await manager.getRepository(UserModule).findOne({
          where: { user_id: user.id, module_id: mod.id },
        });

        if (!userMod) {
          userMod = manager.getRepository(UserModule).create({
            user_id: user.id,
            module_id: mod.id,
            is_active: true,
          });
          await manager.getRepository(UserModule).save(userMod);
        } else if (!userMod.is_active) {
          userMod.is_active = true;
          await manager.getRepository(UserModule).save(userMod);
        }
      }

      return {
        message: 'Seed completed successfully',
        super_admin_email: user.email,
        role: role.key,
        module_group: moduleGroup.key,
        modules: savedModules.map((m) => m.key),
      };
    });

    // 4. Invalidate Redis authorization cache
    await this.redisService.delByPattern('auth:context:*');

    return result;
  }
}
