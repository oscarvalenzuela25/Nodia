import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity.js';
import { TranslationService } from '../translation/translation.service.js';
import {
  ActionContext,
  AuthorizationContextResponse,
  ModuleContext,
  ModuleGroupContext,
} from './types/authorization.types.js';
import { Action } from '../action/entities/action.entity.js';
import { Module } from '../module/entities/module.entity.js';
import { ModuleGroup } from '../module-group/entities/module-group.entity.js';
import { RedisService } from '../common/redis/redis.service.js';
import {
  canAnalyzeInvoice,
  canUseGemini,
  canUseMistral,
} from '../config/envs.config.js';

@Injectable()
export class AuthorizationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ModuleGroup)
    private readonly moduleGroupRepository: Repository<ModuleGroup>,
    private readonly translationService: TranslationService,
    private readonly redisService: RedisService,
  ) {}

  async getContext(email: string): Promise<AuthorizationContextResponse> {
    const targetEmail = email.toLowerCase().trim();
    const cacheKey = `auth:context:${targetEmail}`;

    const cached =
      await this.redisService.get<AuthorizationContextResponse>(cacheKey);
    if (cached) {
      return {
        ...cached,
        can_analyze_invoice: canAnalyzeInvoice(),
        can_use_gemini: canUseGemini(),
        can_use_mistral: canUseMistral(),
      };
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.user_roles', 'user_roles')
      .leftJoinAndSelect('user_roles.role', 'role')
      .leftJoinAndSelect('role.role_actions', 'role_actions')
      .leftJoinAndSelect('role_actions.action', 'action')
      .leftJoinAndSelect('user.user_modules', 'user_modules')
      .leftJoinAndSelect('user_modules.module', 'module')
      .leftJoinAndSelect('module.module_group', 'module_group')
      .where('LOWER(user.email) = :email', { email: targetEmail })
      .getOne();

    if (!user || user.is_active === false) {
      throw new NotFoundException(
        `User with email "${targetEmail}" not found or inactive`,
      );
    }

    // 1. Roles: Get keys of active roles
    const activeUserRoles = (user.user_roles ?? []).filter(
      (ur) => ur.is_active !== false && ur.role && ur.role.is_active !== false,
    );
    const roleKeys = Array.from(
      new Set(activeUserRoles.map((ur) => ur.role.key)),
    );

    // 2. Actions: Get unique active actions from active roles
    const activeActionsMap = new Map<string, Action>();
    for (const ur of activeUserRoles) {
      for (const ra of ur.role.role_actions ?? []) {
        if (
          ra.is_active !== false &&
          ra.action &&
          ra.action.is_active !== false
        ) {
          activeActionsMap.set(String(ra.action.id), ra.action);
        }
      }
    }

    const rawActions = Array.from(activeActionsMap.values());
    const translatedActions =
      rawActions.length > 0
        ? await this.translationService.attachTranslations(
            'actions',
            rawActions,
          )
        : [];

    const actions: ActionContext[] = translatedActions.map((act) => ({
      key: act.key,
      translates: act.translates ?? [],
    }));

    // 3. Modules: Get unique active modules assigned to user
    const activeUserModules = (user.user_modules ?? []).filter(
      (um) =>
        um.is_active !== false && um.module && um.module.is_active !== false,
    );

    const activeModulesMap = new Map<string, Module>();
    for (const um of activeUserModules) {
      activeModulesMap.set(String(um.module.id), um.module);
    }

    // Resolve module groups (either from relation or by fetching missing module_group_id)
    const activeGroupsMap = new Map<string, ModuleGroup>();
    const missingGroupIds: string[] = [];

    for (const mod of activeModulesMap.values()) {
      if (mod.module_group && mod.module_group.id) {
        if (mod.module_group.is_active !== false) {
          activeGroupsMap.set(String(mod.module_group.id), mod.module_group);
        }
      } else if (mod.module_group_id) {
        missingGroupIds.push(String(mod.module_group_id));
      }
    }

    if (missingGroupIds.length > 0) {
      const fetchedGroups = await this.moduleGroupRepository.find({
        where: { id: In(missingGroupIds) },
      });
      for (const group of fetchedGroups) {
        if (group.is_active !== false) {
          activeGroupsMap.set(String(group.id), group);
        }
      }
    }

    // Filter modules to only those whose group is found and active
    const validModules = Array.from(activeModulesMap.values()).filter((mod) => {
      const groupId = String(mod.module_group?.id || mod.module_group_id);
      return activeGroupsMap.has(groupId);
    });

    const rawGroups = Array.from(activeGroupsMap.values());

    const translatedGroups =
      rawGroups.length > 0
        ? await this.translationService.attachTranslations(
            'module_groups',
            rawGroups,
          )
        : [];
    const translatedModules =
      validModules.length > 0
        ? await this.translationService.attachTranslations(
            'modules',
            validModules,
          )
        : [];

    // Group modules by module_group_id
    const modulesByGroupId = new Map<string, ModuleContext[]>();
    for (const m of translatedModules) {
      const groupId = String(m.module_group?.id || m.module_group_id);
      if (!modulesByGroupId.has(groupId)) {
        modulesByGroupId.set(groupId, []);
      }
      modulesByGroupId.get(groupId)!.push({
        key: m.key,
        link: m.link,
        icon: m.icon ?? null,
        translates: m.translates ?? [],
      });
    }

    const moduleGroupsContext: ModuleGroupContext[] = translatedGroups.map(
      (group) => ({
        module_group_key: group.key,
        icon: group.icon ?? null,
        translates: group.translates ?? [],
        modules: modulesByGroupId.get(String(group.id)) ?? [],
      }),
    );

    const result: AuthorizationContextResponse = {
      roles: roleKeys,
      actions,
      modules: moduleGroupsContext,
      can_analyze_invoice: canAnalyzeInvoice(),
      can_use_gemini: canUseGemini(),
      can_use_mistral: canUseMistral(),
    };

    await this.redisService.set(cacheKey, result, 3600);

    return result;
  }
}
