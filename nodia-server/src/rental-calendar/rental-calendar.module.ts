import { Module } from '@nestjs/common';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalCalendarController } from './rental-calendar.controller.js';
import {
  GetRentalCalendarUseCase,
  GetRentalAvailabilityUseCase,
} from './use-case/get-rental-calendar.use-case.js';
import { RentalCalendarService } from './rental-calendar.service.js';
@Module({
  imports: [RentalCommonModule],
  controllers: [RentalCalendarController],
  providers: [
    RentalCalendarService,
    GetRentalCalendarUseCase,
    GetRentalAvailabilityUseCase,
  ],
  exports: [
    RentalCalendarService,
    GetRentalCalendarUseCase,
    GetRentalAvailabilityUseCase,
  ],
})
export class RentalCalendarModule {}
