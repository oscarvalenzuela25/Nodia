import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalReservationController } from './rental-reservation.controller.js';
import { CancelRentalReservationUseCase } from './use-case/cancel-rental-reservation.use-case.js';
import { CompleteRentalReservationUseCase } from './use-case/complete-rental-reservation.use-case.js';
import { ConfirmRentalReservationUseCase } from './use-case/confirm-rental-reservation.use-case.js';
import { CreateRentalReservationUseCase } from './use-case/create-rental-reservation.use-case.js';
import { GetRentalReservationUseCase } from './use-case/get-rental-reservation.use-case.js';
import { ListRentalReservationUseCase } from './use-case/list-rental-reservation.use-case.js';
import { PreviewRentalCancellationUseCase } from './use-case/preview-rental-cancellation.use-case.js';
import { StartRentalReservationUseCase } from './use-case/start-rental-reservation.use-case.js';
import { UpdateRentalReservationUseCase } from './use-case/update-rental-reservation.use-case.js';
import { RentalReservationService } from './rental-reservation.service.js';
import { RentalReservation } from './entities/rental-reservation.entity.js';
@Module({
  imports: [RentalCommonModule, TypeOrmModule.forFeature([RentalReservation])],
  controllers: [RentalReservationController],
  providers: [
    RentalReservationService,
    CancelRentalReservationUseCase,
    CompleteRentalReservationUseCase,
    ConfirmRentalReservationUseCase,
    CreateRentalReservationUseCase,
    GetRentalReservationUseCase,
    ListRentalReservationUseCase,
    PreviewRentalCancellationUseCase,
    StartRentalReservationUseCase,
    UpdateRentalReservationUseCase,
  ],
  exports: [
    RentalReservationService,
    CancelRentalReservationUseCase,
    CompleteRentalReservationUseCase,
    ConfirmRentalReservationUseCase,
    CreateRentalReservationUseCase,
    GetRentalReservationUseCase,
    ListRentalReservationUseCase,
    PreviewRentalCancellationUseCase,
    StartRentalReservationUseCase,
    UpdateRentalReservationUseCase,
  ],
})
export class RentalReservationModule {}
