import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiProvider } from './entities/ai-provider.entity.js';
import { AiApiKey } from './entities/ai-api-key.entity.js';
import { AiProviderEvent } from './entities/ai-provider-event.entity.js';
import { AiProviderService } from './ai-provider.service.js';
import { AiProviderController } from './ai-provider.controller.js';
import { AiApiKeyController } from './ai-api-key.controller.js';
import { AiProviderEventController } from './ai-provider-event.controller.js';

// AiProvider Use Cases
import { GetAllAiProvidersUseCase } from './use-case/get-all-ai-providers.use-case.js';
import { CreateAiProviderUseCase } from './use-case/create-ai-provider.use-case.js';
import { UpdateAiProviderUseCase } from './use-case/update-ai-provider.use-case.js';
import { GetSelectableModelsUseCase } from './use-case/get-selectable-models.use-case.js';
import { GetAiProvidersHealthUseCase } from './use-case/get-ai-providers-health.use-case.js';
import { GetEnabledWebAiProvidersUseCase } from './use-case/get-enabled-web-ai-providers.use-case.js';
import { GetSupportedAiProvidersUseCase } from './use-case/get-supported-ai-providers.use-case.js';

// AiApiKey Use Cases
import { GetAllAiApiKeysUseCase } from './use-case/get-all-ai-api-keys.use-case.js';
import { CreateAiApiKeyUseCase } from './use-case/create-ai-api-key.use-case.js';
import { UpdateAiApiKeyUseCase } from './use-case/update-ai-api-key.use-case.js';
import { DeleteAiApiKeyUseCase } from './use-case/delete-ai-api-key.use-case.js';

// AiProviderEvent Use Cases
import { GetAllAiProviderEventsUseCase } from './use-case/get-all-ai-provider-events.use-case.js';
import { CreateAiProviderEventUseCase } from './use-case/create-ai-provider-event.use-case.js';

import { GeminiModule } from '../common/ai/gemini.module.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiProvider,
      AiApiKey,
      AiProviderEvent,
    ]),
    GeminiModule,
    TranslationModule,
  ],
  controllers: [
    AiProviderController,
    AiApiKeyController,
    AiProviderEventController,
  ],
  providers: [
    AiProviderService,
    // AiProvider
    GetAllAiProvidersUseCase,
    CreateAiProviderUseCase,
    UpdateAiProviderUseCase,
    GetSelectableModelsUseCase,
    GetAiProvidersHealthUseCase,
    GetEnabledWebAiProvidersUseCase,
    GetSupportedAiProvidersUseCase,
    // AiApiKey
    GetAllAiApiKeysUseCase,
    CreateAiApiKeyUseCase,
    UpdateAiApiKeyUseCase,
    DeleteAiApiKeyUseCase,
    // AiProviderEvent
    GetAllAiProviderEventsUseCase,
    CreateAiProviderEventUseCase,
  ],
  exports: [
    AiProviderService,
    GetAllAiProvidersUseCase,
    CreateAiProviderUseCase,
    UpdateAiProviderUseCase,
    GetSelectableModelsUseCase,
    GetAiProvidersHealthUseCase,
    GetEnabledWebAiProvidersUseCase,
    GetSupportedAiProvidersUseCase,
    GetAllAiApiKeysUseCase,
    CreateAiApiKeyUseCase,
    UpdateAiApiKeyUseCase,
    GetAllAiProviderEventsUseCase,
    CreateAiProviderEventUseCase,
  ],
})
export class AiProviderModule {}
