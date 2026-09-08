import { Module } from '@nestjs/common';
import { ModuleService } from './module.service.js';
import { ModuleController } from './module.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module as ModuleEntity } from './entities/module.entity.js';
import { GetAllModulesUseCase } from './use-case/get-all-modules.use-case.js';
import { CreateModuleUseCase } from './use-case/create-module.use-case.js';
import { UpdateModuleUseCase } from './use-case/update-module.use-case.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleEntity]), TranslationModule],
  controllers: [ModuleController],
  providers: [
    ModuleService,
    GetAllModulesUseCase,
    CreateModuleUseCase,
    UpdateModuleUseCase,
  ],
  exports: [ModuleService],
})
export class ModuleModule {}
