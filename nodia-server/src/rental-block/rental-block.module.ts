import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalBlockController } from './rental-block.controller.js';
import { CreateRentalBlockUseCase } from './use-case/create-rental-block.use-case.js';
import {
  GetRentalBlocksUseCase,
  GetRentalBlockUseCase,
} from './use-case/get-rental-blocks.use-case.js';
import { UpdateRentalBlockUseCase } from './use-case/update-rental-block.use-case.js';
import { RentalBlockService } from './rental-block.service.js';
import { RentalBlock } from './entities/rental-block.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalBlock])],
  controllers: [RentalBlockController],
  providers: [
    RentalBlockService,
    CreateRentalBlockUseCase,
    GetRentalBlocksUseCase,
    GetRentalBlockUseCase,
    UpdateRentalBlockUseCase,
  ],
  exports: [
    RentalBlockService,
    CreateRentalBlockUseCase,
    GetRentalBlocksUseCase,
    GetRentalBlockUseCase,
    UpdateRentalBlockUseCase,
  ],
})
export class RentalBlockModule {}
