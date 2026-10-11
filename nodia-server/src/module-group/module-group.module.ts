import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleGroup } from './entities/module-group.entity.js';
import { ModuleGroupController } from './module-group.controller.js';
import { ModuleGroupService } from './module-group.service.js';
import { GetAllModuleGroupsUseCase } from './use-case/get-all-module-groups.use-case.js';
import { CreateModuleGroupUseCase } from './use-case/create-module-group.use-case.js';
import { UpdateModuleGroupUseCase } from './use-case/update-module-group.use-case.js';
import { DeleteModuleGroupUseCase } from './use-case/delete-module-group.use-case.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleGroup]), TranslationModule],
  controllers: [ModuleGroupController],
  providers: [
    ModuleGroupService,
    GetAllModuleGroupsUseCase,
    CreateModuleGroupUseCase,
    UpdateModuleGroupUseCase,
    DeleteModuleGroupUseCase,
  ],
  exports: [ModuleGroupService, TypeOrmModule],
})
export class ModuleGroupModule {}
