import { Module } from '@nestjs/common';
import { RedisModule } from '../common/redis/redis.module.js';
import { UserModule } from '../user/user.module.js';
import { RoleModule } from '../role/role.module.js';
import { ActionModule } from '../action/action.module.js';
import { ModuleModule } from '../module/module.module.js';
import { ModuleGroupModule } from '../module-group/module-group.module.js';
import { BusinessActionModule } from '../business-action/business-action.module.js';
import { NodiaAiCoreOperationsService } from './nodia-ai-core-operations.service.js';
import { BuildNodiaAiCoreOperationsUseCase } from './use-case/build-nodia-ai-core-operations.use-case.js';
import { NODIA_AI_CORE_OPERATIONS } from './types/core-operation.types.js';

@Module({
  imports: [
    RedisModule,
    UserModule,
    RoleModule,
    ActionModule,
    ModuleModule,
    ModuleGroupModule,
    BusinessActionModule,
  ],
  providers: [
    NodiaAiCoreOperationsService,
    BuildNodiaAiCoreOperationsUseCase,
    {
      provide: NODIA_AI_CORE_OPERATIONS,
      inject: [BuildNodiaAiCoreOperationsUseCase],
      useFactory: (factory: BuildNodiaAiCoreOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [BuildNodiaAiCoreOperationsUseCase, NODIA_AI_CORE_OPERATIONS],
})
export class NodiaAiCoreOperationsModule {}
