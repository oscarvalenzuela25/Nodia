import { Module } from '@nestjs/common';
import { NODIA_AI_SECURE_OPERATIONS } from '../nodia-ai-proposal/types/secure-operation.types.js';
import { NodiaAiSecurePreparationService } from './nodia-ai-secure-preparation.service.js';
import { BuildNodiaAiSecureOperationsUseCase } from './use-case/build-nodia-ai-secure-operations.use-case.js';
@Module({
  providers: [
    NodiaAiSecurePreparationService,
    BuildNodiaAiSecureOperationsUseCase,
    {
      provide: NODIA_AI_SECURE_OPERATIONS,
      inject: [BuildNodiaAiSecureOperationsUseCase],
      useFactory: (builder: BuildNodiaAiSecureOperationsUseCase) =>
        builder.operations,
    },
  ],
  exports: [NODIA_AI_SECURE_OPERATIONS, BuildNodiaAiSecureOperationsUseCase],
})
export class NodiaAiSecurePreparationModule {}
