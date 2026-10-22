import { Module } from '@nestjs/common';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiProposalModule } from '../nodia-ai-proposal/nodia-ai-proposal.module.js';
import { NodiaAiPreferenceOperationsModule } from './nodia-ai-preference-operations.module.js';
import { NodiaAiPreferenceController } from './nodia-ai-preference.controller.js';
import { ListNodiaAiPreferencesUseCase } from './use-case/list-nodia-ai-preferences.use-case.js';
import { GetNodiaAiPreferenceCatalogUseCase } from './use-case/get-nodia-ai-preference-catalog.use-case.js';
import { GetNodiaAiPreferenceOptionsUseCase } from './use-case/get-nodia-ai-preference-options.use-case.js';
import { PrepareNodiaAiPreferenceUseCase } from './use-case/prepare-nodia-ai-preference.use-case.js';
@Module({
  imports: [
    NodiaAiAuthorizationModule,
    NodiaAiPreferenceOperationsModule,
    NodiaAiProposalModule,
  ],
  controllers: [NodiaAiPreferenceController],
  providers: [
    ListNodiaAiPreferencesUseCase,
    GetNodiaAiPreferenceCatalogUseCase,
    GetNodiaAiPreferenceOptionsUseCase,
    PrepareNodiaAiPreferenceUseCase,
  ],
  exports: [NodiaAiPreferenceOperationsModule, ListNodiaAiPreferencesUseCase],
})
export class NodiaAiPreferenceModule {}
