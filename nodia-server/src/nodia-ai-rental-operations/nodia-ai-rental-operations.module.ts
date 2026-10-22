import { Module } from '@nestjs/common';
import { RentalCommonModule } from '../rental-common/rental-common.module.js';
import { RentalBlockModule } from '../rental-block/rental-block.module.js';
import { RentalTurnoverModule } from '../rental-turnover/rental-turnover.module.js';
import { NodiaAiRentalOperationsService } from './nodia-ai-rental-operations.service.js';
import { NODIA_AI_RENTAL_OPERATIONS } from './types/rental-operation.types.js';
import { BuildNodiaAiRentalOperationsUseCase } from './use-case/build-nodia-ai-rental-operations.use-case.js';

@Module({
  imports: [RentalCommonModule, RentalBlockModule, RentalTurnoverModule],
  providers: [
    NodiaAiRentalOperationsService,
    BuildNodiaAiRentalOperationsUseCase,
    {
      provide: NODIA_AI_RENTAL_OPERATIONS,
      inject: [BuildNodiaAiRentalOperationsUseCase],
      useFactory: (factory: BuildNodiaAiRentalOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [BuildNodiaAiRentalOperationsUseCase, NODIA_AI_RENTAL_OPERATIONS],
})
export class NodiaAiRentalOperationsModule {}
