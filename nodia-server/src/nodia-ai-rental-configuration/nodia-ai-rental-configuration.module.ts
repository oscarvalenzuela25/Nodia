import { Module } from '@nestjs/common';
import { RentalPropertyModule } from '../rental-property/rental-property.module.js';
import { RentalCollaboratorModule } from '../rental-collaborator/rental-collaborator.module.js';
import { RentalCancellationPolicyModule } from '../rental-cancellation-policy/rental-cancellation-policy.module.js';
import { NodiaAiRentalConfigurationService } from './nodia-ai-rental-configuration.service.js';
import { BuildNodiaAiRentalConfigurationOperationsUseCase } from './use-case/build-nodia-ai-rental-configuration-operations.use-case.js';
import { NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS } from './types/rental-configuration-operation.types.js';

@Module({
  imports: [
    RentalPropertyModule,
    RentalCollaboratorModule,
    RentalCancellationPolicyModule,
  ],
  providers: [
    NodiaAiRentalConfigurationService,
    BuildNodiaAiRentalConfigurationOperationsUseCase,
    {
      provide: NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS,
      inject: [BuildNodiaAiRentalConfigurationOperationsUseCase],
      useFactory: (factory: BuildNodiaAiRentalConfigurationOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [
    BuildNodiaAiRentalConfigurationOperationsUseCase,
    NODIA_AI_RENTAL_CONFIGURATION_OPERATIONS,
  ],
})
export class NodiaAiRentalConfigurationModule {}
