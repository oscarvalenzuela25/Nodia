import { Module } from '@nestjs/common';
import { NodiaAiAuthorizationService } from './nodia-ai-authorization.service.js';
import { AuthorizeNodiaAiUseCase } from './use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiResourceUseCase } from './use-case/authorize-nodia-ai-resource.use-case.js';
import { ExecuteAuthorizedNodiaAiUseCase } from './use-case/execute-authorized-nodia-ai.use-case.js';
@Module({
  providers: [
    NodiaAiAuthorizationService,
    AuthorizeNodiaAiUseCase,
    AuthorizeNodiaAiResourceUseCase,
    ExecuteAuthorizedNodiaAiUseCase,
  ],
  exports: [
    AuthorizeNodiaAiUseCase,
    AuthorizeNodiaAiResourceUseCase,
    ExecuteAuthorizedNodiaAiUseCase,
  ],
})
export class NodiaAiAuthorizationModule {}
