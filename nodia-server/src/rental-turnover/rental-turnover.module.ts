import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalTurnoverController } from './rental-turnover.controller.js';
import { ApproveSameDayRentalTurnoverUseCase } from './use-case/approve-same-day-rental-turnover.use-case.js';
import { GetRentalTurnoverUseCase } from './use-case/get-rental-turnover.use-case.js';
import { ListRentalTurnoverUseCase } from './use-case/list-rental-turnover.use-case.js';
import { UpdateRentalTurnoverUseCase } from './use-case/update-rental-turnover.use-case.js';
import { RentalTurnoverService } from './rental-turnover.service.js';
import { RentalTurnover } from './entities/rental-turnover.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalTurnover])],
  controllers: [RentalTurnoverController],
  providers: [
    RentalTurnoverService,
    ApproveSameDayRentalTurnoverUseCase,
    GetRentalTurnoverUseCase,
    ListRentalTurnoverUseCase,
    UpdateRentalTurnoverUseCase,
  ],
  exports: [
    RentalTurnoverService,
    ApproveSameDayRentalTurnoverUseCase,
    GetRentalTurnoverUseCase,
    ListRentalTurnoverUseCase,
    UpdateRentalTurnoverUseCase,
  ],
})
export class RentalTurnoverModule {}
