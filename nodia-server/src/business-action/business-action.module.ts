import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessAction } from './entities/business-action.entity.js';
import { BusinessActionService } from './business-action.service.js';
import { BusinessActionController } from './business-action.controller.js';
import { GetAllBusinessActionsUseCase } from './use-case/get-all-business-actions.use-case.js';
import { CreateBusinessActionUseCase } from './use-case/create-business-action.use-case.js';
import { UpdateBusinessActionUseCase } from './use-case/update-business-action.use-case.js';
import { DeleteBusinessActionUseCase } from './use-case/delete-business-action.use-case.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessAction]), TranslationModule],
  controllers: [BusinessActionController],
  providers: [
    BusinessActionService,
    GetAllBusinessActionsUseCase,
    CreateBusinessActionUseCase,
    UpdateBusinessActionUseCase,
    DeleteBusinessActionUseCase,
  ],
  exports: [BusinessActionService],
})
export class BusinessActionModule {}
