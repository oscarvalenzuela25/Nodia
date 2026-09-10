import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { ModuleGroup } from '../module-group/entities/module-group.entity.js';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationService } from './authorization.service.js';
import { GetAuthorizationContextUseCase } from './use-case/get-authorization-context.use-case.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, ModuleGroup]), TranslationModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationService, GetAuthorizationContextUseCase],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
