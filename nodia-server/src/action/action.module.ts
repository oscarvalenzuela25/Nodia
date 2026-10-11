import { Module } from '@nestjs/common';
import { ActionService } from './action.service.js';
import { ActionController } from './action.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from './entities/action.entity.js';
import { GetAllActionsUseCase } from './use-case/get-all-actions.use-case.js';
import { CreateActionUseCase } from './use-case/create-action.use-case.js';
import { UpdateActionUseCase } from './use-case/update-action.use-case.js';
import { DeleteActionUseCase } from './use-case/delete-action.use-case.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  controllers: [ActionController],
  providers: [
    ActionService,
    GetAllActionsUseCase,
    CreateActionUseCase,
    UpdateActionUseCase,
    DeleteActionUseCase,
  ],
  imports: [TypeOrmModule.forFeature([Action]), TranslationModule],
})
export class ActionModule {}
