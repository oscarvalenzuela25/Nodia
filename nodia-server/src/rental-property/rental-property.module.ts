import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalPropertyController } from './rental-property.controller.js';
import { CreateRentalPropertyUseCase } from './use-case/create-rental-property.use-case.js';
import { GetRentalPropertiesUseCase } from './use-case/get-rental-properties.use-case.js';
import { GetRentalPropertyUseCase } from './use-case/get-rental-property.use-case.js';
import { UpdateRentalPropertyUseCase } from './use-case/update-rental-property.use-case.js';
import { RentalPropertyService } from './rental-property.service.js';
import { RentalProperty } from './entities/rental-property.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalProperty])],
  controllers: [RentalPropertyController],
  providers: [
    RentalPropertyService,
    CreateRentalPropertyUseCase,
    GetRentalPropertiesUseCase,
    GetRentalPropertyUseCase,
    UpdateRentalPropertyUseCase,
  ],
  exports: [
    RentalPropertyService,
    CreateRentalPropertyUseCase,
    GetRentalPropertiesUseCase,
    GetRentalPropertyUseCase,
    UpdateRentalPropertyUseCase,
  ],
})
export class RentalPropertyModule {}
