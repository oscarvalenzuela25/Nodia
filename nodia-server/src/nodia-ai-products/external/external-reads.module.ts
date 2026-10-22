import { Module } from '@nestjs/common';
import { GeminiModule } from '../../common/ai/gemini.module.js';
import { GeminiService } from '../../common/ai/gemini.service.js';
import { ApiProviderService } from '../../common/ai/api-provider.service.js';
import { CodexRuntimeModule } from '../../common/ai/codex/codex-runtime.module.js';
import { CodexRuntimeService } from '../../common/ai/codex/codex-runtime.service.js';
import {
  createNodiaAiExternalReadFamily,
  NODIA_AI_EXTERNAL_READ_FAMILY,
} from './external-read.family.js';

@Module({
  imports: [GeminiModule, CodexRuntimeModule],
  providers: [
    {
      provide: NODIA_AI_EXTERNAL_READ_FAMILY,
      inject: [GeminiService, ApiProviderService, CodexRuntimeService],
      useFactory: (
        gemini: GeminiService,
        api: ApiProviderService,
        codex: CodexRuntimeService,
      ) => createNodiaAiExternalReadFamily({ gemini, api, codex }),
    },
  ],
  exports: [NODIA_AI_EXTERNAL_READ_FAMILY],
})
export class NodiaAiExternalReadsModule {}
