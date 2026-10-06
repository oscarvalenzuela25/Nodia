import { Module } from '@nestjs/common';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalOverviewController } from './rental-overview.controller.js';
import { GetRentalOverviewUseCase } from './use-case/get-rental-overview.use-case.js';
import { RentalOverviewService } from './rental-overview.service.js';
@Module({
  imports: [RentalCommonModule],
  controllers: [RentalOverviewController],
  providers: [RentalOverviewService, GetRentalOverviewUseCase],
  exports: [RentalOverviewService, GetRentalOverviewUseCase],
})
export class RentalOverviewModule {}
