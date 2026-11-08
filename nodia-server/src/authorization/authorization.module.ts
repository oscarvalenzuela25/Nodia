import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { ModuleGroup } from '../module-group/entities/module-group.entity.js';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';
import { GetAuthorizationContextUseCase } from './use-case/get-authorization-context.use-case.js';
import { CheckActionPermissionUseCase } from './use-case/check-action-permission.use-case.js';
import { ActionPermissionGuard } from './action-permission.guard.js';
import { TranslationModule } from '../translation/translation.module.js';
import { CheckModuleAccessUseCase } from './use-case/check-module-access.use-case.js';
import { ModuleAccessGuard } from './module-access.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, ModuleGroup]), TranslationModule],
  controllers: [AuthorizationController],
  providers: [
    AuthorizationService,
    GetAuthorizationContextUseCase,
    CheckActionPermissionUseCase,
    ActionPermissionGuard,
    CheckModuleAccessUseCase,
    ModuleAccessGuard,
  ],
  exports: [AuthorizationService, ActionPermissionGuard, CheckModuleAccessUseCase, ModuleAccessGuard],
})
export class AuthorizationModule {}
