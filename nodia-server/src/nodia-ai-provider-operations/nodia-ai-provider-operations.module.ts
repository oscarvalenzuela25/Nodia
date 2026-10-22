import { Module } from '@nestjs/common';
import { AiProviderModule } from '../ai-provider/ai-provider.module.js';
import { NodiaAiProviderOperationsService } from './nodia-ai-provider-operations.service.js';
import { BuildNodiaAiProviderOperationsUseCase } from './use-case/build-nodia-ai-provider-operations.use-case.js';
import { NODIA_AI_PROVIDER_OPERATIONS } from './types/provider-operation.types.js';

@Module({
  imports: [AiProviderModule],
  providers: [
    NodiaAiProviderOperationsService,
    BuildNodiaAiProviderOperationsUseCase,
    {
      provide: NODIA_AI_PROVIDER_OPERATIONS,
      inject: [BuildNodiaAiProviderOperationsUseCase],
      useFactory: (factory: BuildNodiaAiProviderOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [
    BuildNodiaAiProviderOperationsUseCase,
    NODIA_AI_PROVIDER_OPERATIONS,
  ],
})
export class NodiaAiProviderOperationsModule {}
