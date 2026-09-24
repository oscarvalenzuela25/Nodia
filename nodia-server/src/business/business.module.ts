import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from './entities/business.entity.js';
import { BusinessCollaborator } from './entities/business-collaborator.entity.js';
import { BusinessAction } from '../business-action/entities/business-action.entity.js';
import { Product } from '../product/entities/product.entity.js';
import { Provider } from '../provider/entities/provider.entity.js';
import { BusinessService } from './business.service.js';
import { BusinessController } from './business.controller.js';
import { GetMyBusinessesUseCase } from './use-case/get-my-businesses.use-case.js';
import { CreateBusinessUseCase } from './use-case/create-business.use-case.js';
import { UpdateBusinessUseCase } from './use-case/update-business.use-case.js';
import { AssignBusinessCollaboratorsUseCase } from './use-case/assign-business-collaborators.use-case.js';
import { GetBusinessByIdUseCase } from './use-case/get-business-by-id.use-case.js';

import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      BusinessCollaborator,
      BusinessAction,
      Product,
      Provider,
    ]),
    TranslationModule,
  ],
  controllers: [BusinessController],
  providers: [
    BusinessService,
    GetMyBusinessesUseCase,
    GetBusinessByIdUseCase,
    CreateBusinessUseCase,
    UpdateBusinessUseCase,
    AssignBusinessCollaboratorsUseCase,
  ],
  exports: [BusinessService],
})
export class BusinessModule {}
