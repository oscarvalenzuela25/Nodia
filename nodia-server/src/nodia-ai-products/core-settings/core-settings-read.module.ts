import { Module } from '@nestjs/common';
import { RedisModule } from '../../common/redis/redis.module.js';
import { ActionModule } from '../../action/action.module.js';
import { ActionService } from '../../action/action.service.js';
import { GetAllActionsUseCase } from '../../action/use-case/get-all-actions.use-case.js';
import { BusinessActionModule } from '../../business-action/business-action.module.js';
import { BusinessActionService } from '../../business-action/business-action.service.js';
import { GetAllBusinessActionsUseCase } from '../../business-action/use-case/get-all-business-actions.use-case.js';
import { ModuleModule } from '../../module/module.module.js';
import { ModuleService } from '../../module/module.service.js';
import { GetAllModulesUseCase } from '../../module/use-case/get-all-modules.use-case.js';
import { ModuleGroupModule } from '../../module-group/module-group.module.js';
import { GetAllModuleGroupsUseCase } from '../../module-group/use-case/get-all-module-groups.use-case.js';
import { RoleModule } from '../../role/role.module.js';
import { RoleService } from '../../role/role.service.js';
import { GetAllRolesUseCase } from '../../role/use-case/get-all-roles.use-case.js';
import { UserModule } from '../../user/user.module.js';
import { GetAllUsersUseCase } from '../../user/use-case/get-all-users.use-case.js';
import {
  createNodiaAiCoreSettingsReadFamily,
  NODIA_AI_CORE_SETTINGS_READ_FAMILY,
} from './core-settings-read.family.js';

@Module({
  imports: [
    RedisModule,
    ActionModule,
    BusinessActionModule,
    ModuleModule,
    ModuleGroupModule,
    RoleModule,
    UserModule,
  ],
  providers: [
    {
      provide: NODIA_AI_CORE_SETTINGS_READ_FAMILY,
      inject: [
        ActionService,
        BusinessActionService,
        ModuleService,
        RoleService,
        GetAllActionsUseCase,
        GetAllBusinessActionsUseCase,
        GetAllModulesUseCase,
        GetAllModuleGroupsUseCase,
        GetAllRolesUseCase,
        GetAllUsersUseCase,
      ],
      useFactory: (
        actions: ActionService,
        businessActions: BusinessActionService,
        modules: ModuleService,
        roles: RoleService,
        listActions: GetAllActionsUseCase,
        listBusinessActions: GetAllBusinessActionsUseCase,
        listModules: GetAllModulesUseCase,
        listGroups: GetAllModuleGroupsUseCase,
        listRoles: GetAllRolesUseCase,
        listUsers: GetAllUsersUseCase,
      ) =>
        createNodiaAiCoreSettingsReadFamily({
          actions,
          businessActions,
          modules,
          roles,
          listActions,
          listBusinessActions,
          listModules,
          listGroups,
          listRoles,
          listUsers,
        }),
    },
  ],
  exports: [NODIA_AI_CORE_SETTINGS_READ_FAMILY],
})
export class NodiaAiCoreSettingsReadModule {}
