import { Module } from '@nestjs/common';
import { NodiaAiConversationService } from '../../nodia-ai-conversation/nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { NodiaAiAuthorizationModule } from '../../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../../nodia-ai-runtime/config/runtime-policy.module.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { NodiaAiArtifactsController } from './nodia-ai-artifacts.controller.js';
import { DownloadNodiaAiArtifactUseCase } from './use-case/download-nodia-ai-artifact.use-case.js';
import { ExecuteNodiaAiArtifactUseCase } from './use-case/execute-nodia-ai-artifact.use-case.js';

@Module({
  imports: [NodiaAiAuthorizationModule, NodiaAiRuntimePolicyModule, StorageModule],
  controllers: [NodiaAiArtifactsController],
  providers: [DownloadNodiaAiArtifactUseCase, ExecuteNodiaAiArtifactUseCase, NodiaAiConversationService, AuthorizeNodiaAiConversationUseCase],
  exports: [DownloadNodiaAiArtifactUseCase, ExecuteNodiaAiArtifactUseCase],
})
export class NodiaAiArtifactsModule {}
