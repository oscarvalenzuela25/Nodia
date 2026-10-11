import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
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

    return this.initialize(dto.super_admin_email, false);
  }

  /** Private operational entry point; never exposed as an HTTP route. */
  async bootstrap() {
    return this.initialize(envs.BOOTSTRAP_SUPER_ADMIN_EMAIL, true);
  }

  private async initialize(email: string, allowExisting: boolean) {
    const normalizedEmail =
      typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!isEmail(normalizedEmail)) {
      throw new BadRequestException(
        'A valid BOOTSTRAP_SUPER_ADMIN_EMAIL is required for Core bootstrap',
      );
    }

    // Serialize bootstrap across CLI/HTTP and processes before checking or creating the role.
    const result = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(1789257400)');
      const superAdminRole = await manager.getRepository(Role).findOne({
        where: { key: 'super_admin' },
      });
      if (superAdminRole) {
        const assignment = await manager.getRepository(UserRole).findOne({
          where: { role_id: superAdminRole.id },
        });
        if (assignment) {
          const existing = await manager
            .getRepository(User)
            .findOne({ where: { id: assignment.user_id } });
          if (
            !allowExisting ||
            !assignment.is_active ||
            !existing?.is_active ||
            !superAdminRole.is_active ||
            existing.email.trim().toLowerCase() !== normalizedEmail
          ) {
            throw new ConflictException(
              'A super admin already exists; changing the bootstrap email cannot replace or promote another account',
            );
          }
          const keys = ['users', 'roles', 'actions', 'modules'];
          const group = await manager
            .getRepository(ModuleGroup)
            .findOne({ where: { key: 'general_settings', is_active: true } });
          if (!group)
            throw new ConflictException(
              'Core access has changed; manage existing permissions explicitly in Settings',
            );
          for (const key of keys) {
            const module = await manager
              .getRepository(Module)
              .findOne({ where: { key, is_active: true } });
            const access =
              module &&
              (await manager.getRepository(UserModule).findOne({
                where: {
                  user_id: existing.id,
                  module_id: module.id,
                  is_active: true,
                },
              }));
            if (
              !module ||
              module.module_group_id !== group.id ||
              module.link !== `/settings/${key}` ||
              !access
            ) {
              throw new ConflictException(
                'Core access has changed; manage existing permissions explicitly in Settings',
              );
            }
          }
          return {
            message: 'Seed completed successfully',
            super_admin_email: existing.email,
            role: superAdminRole.key,
            module_group: group.key,
            modules: keys,
          };
        }
      }
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

      await this.translationService.updateTranslations(
        'roles',
        role.id,
        [
          {
            key: 'key',
            es: 'Super Administrador',
            en: 'Super Administrator',
          },
        ],
        manager,
      );

      // 3.2 ModuleGroup: general_settings
      let moduleGroup = await manager.getRepository(ModuleGroup).findOne({
        where: { key: 'general_settings' },
      });
      if (!moduleGroup) {
        moduleGroup = manager.getRepository(ModuleGroup).create({
          key: 'general_settings',
          is_active: true,
        });
        moduleGroup = await manager
          .getRepository(ModuleGroup)
          .save(moduleGroup);
      } else if (!moduleGroup.is_active) {
        moduleGroup.is_active = true;
        moduleGroup = await manager
          .getRepository(ModuleGroup)
          .save(moduleGroup);
      }

      await this.translationService.updateTranslations(
        'module_groups',
        moduleGroup.id,
        [
          {
            key: 'key',
            es: 'Administrador General',
            en: 'General Administration',
          },
        ],
        manager,
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

        await this.translationService.updateTranslations(
          'modules',
          mod.id,
          item.translates,
          manager,
        );
        savedModules.push(mod);
      }

      // 3.4 User: super_admin_email
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
