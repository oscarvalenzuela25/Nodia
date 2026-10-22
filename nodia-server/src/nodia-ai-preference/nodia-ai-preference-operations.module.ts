import { NodiaAiJournalModule } from '../nodia-ai-recovery/nodia-ai-journal.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiPreference } from './entities/nodia-ai-preference.entity.js';
import { NodiaAiPreferenceService } from './nodia-ai-preference.service.js';
import { NodiaAiPreferenceReaderUseCase } from './use-case/nodia-ai-preference-reader.use-case.js';
import { BuildNodiaAiPreferenceOperationsUseCase } from './use-case/build-nodia-ai-preference-operations.use-case.js';
import { NODIA_AI_PREFERENCE_OPERATIONS } from './types/preference.types.js';
/** No proposal/processing import: both consume this bounded memory port. */
@Module({
  imports: [
    NodiaAiJournalModule,
    NodiaAiAuthorizationModule,
    TypeOrmModule.forFeature([NodiaAiPreference]),
  ],
  providers: [
    NodiaAiPreferenceService,
    NodiaAiPreferenceReaderUseCase,
    BuildNodiaAiPreferenceOperationsUseCase,
    {
      provide: NODIA_AI_PREFERENCE_OPERATIONS,
      inject: [BuildNodiaAiPreferenceOperationsUseCase],
      useFactory: (factory: BuildNodiaAiPreferenceOperationsUseCase) =>
        factory.operations,
    },
  ],
  exports: [
    NodiaAiPreferenceService,
    NodiaAiPreferenceReaderUseCase,
    BuildNodiaAiPreferenceOperationsUseCase,
    NODIA_AI_PREFERENCE_OPERATIONS,
  ],
})
export class NodiaAiPreferenceOperationsModule {}
