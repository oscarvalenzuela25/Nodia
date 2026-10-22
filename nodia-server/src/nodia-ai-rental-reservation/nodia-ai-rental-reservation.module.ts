import { Module } from '@nestjs/common';
import { RentalReservationModule } from '../rental-reservation/rental-reservation.module.js';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { NodiaAiRentalReservationService } from './nodia-ai-rental-reservation.service.js';
import { BuildNodiaAiRentalReservationOperationsUseCase } from './use-case/build-nodia-ai-rental-reservation-operations.use-case.js';
import { NODIA_AI_RENTAL_RESERVATION_OPERATIONS } from './types/rental-reservation-operation.types.js';

@Module({
  imports: [RentalCommonModule, RentalReservationModule],
  providers: [
    NodiaAiRentalReservationService,
    BuildNodiaAiRentalReservationOperationsUseCase,
    {
      provide: NODIA_AI_RENTAL_RESERVATION_OPERATIONS,
      inject: [BuildNodiaAiRentalReservationOperationsUseCase],
      useFactory: (factory: BuildNodiaAiRentalReservationOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [
    BuildNodiaAiRentalReservationOperationsUseCase,
    NODIA_AI_RENTAL_RESERVATION_OPERATIONS,
  ],
})
export class NodiaAiRentalReservationModule {}
