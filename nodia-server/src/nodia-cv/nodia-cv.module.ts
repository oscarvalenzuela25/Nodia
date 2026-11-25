import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiGenerationModule } from '../ai-generation/ai-generation.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { NodiaAiJournalModule } from '../nodia-ai-recovery/nodia-ai-journal.module.js';
import { CodexRuntimeModule } from '../common/ai/codex/codex-runtime.module.js';
import { CodexRuntimeService } from '../common/ai/codex/codex-runtime.service.js';
import { CodexChatRuntime } from '../common/ai/codex/codex-chat-runtime.js';
import { NodiaCvCodexSelection } from './agentic/nodia-cv-codex-selection.js';
import { NodiaCvCodexTransport } from './agentic/nodia-cv-codex-transport.js';
import { NodiaCvProfileCreateReceiptEntity } from './entities/nodia-cv-profile-create-receipt.entity.js';
import { NodiaCvProfileEntity } from './entities/nodia-cv-profile.entity.js';
import { NodiaCvProfilesController } from './nodia-cv-profiles.controller.js';
import { NodiaCvProfilesService } from './nodia-cv-profiles.service.js';
import { NodiaCvProfilesUseCase } from './use-case/nodia-cv-profiles.use-case.js';
import { NodiaCvGenerationsController } from './nodia-cv-generations.controller.js';
import { NodiaCvGenerationScope } from './nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from './nodia-cv-generation.store.js';
import { NodiaCvGenerationWorker } from './nodia-cv-generation.worker.js';
import { NodiaCvSelectionService } from './nodia-cv-selection.service.js';
import { NodiaCvGenerationsUseCase } from './use-case/nodia-cv-generations.use-case.js';
import { NodiaCvPdfVersionsController } from './nodia-cv-pdf-versions.controller.js';
import { NodiaCvPdfVersionsStore } from './nodia-cv-pdf-versions.store.js';
import { NodiaCvPdfRenderer } from './pdf/nodia-cv-pdf-renderer.service.js';
import { NodiaCvPdfVersionsUseCase } from './use-case/nodia-cv-pdf-versions.use-case.js';

@Module({
  imports: [
    AuthorizationModule,
    AiGenerationModule,
    NodiaAiJournalModule,
    NodiaAiRuntimePolicyModule,
    CodexRuntimeModule,
    TypeOrmModule.forFeature([
      NodiaCvProfileEntity,
      NodiaCvProfileCreateReceiptEntity,
    ]),
  ],
  controllers: [
    NodiaCvProfilesController,
    NodiaCvGenerationsController,
    NodiaCvPdfVersionsController,
  ],
  providers: [
    NodiaCvProfilesService,
    NodiaCvProfilesUseCase,
    NodiaCvCodexSelection,
    {
      provide: NodiaCvCodexTransport,
      inject: [NodiaCvCodexSelection, CodexRuntimeService, CodexChatRuntime],
      useFactory: (
        selection: NodiaCvCodexSelection,
        runtime: CodexRuntimeService,
        chat: CodexChatRuntime,
      ) => new NodiaCvCodexTransport(selection, runtime, chat.journal),
    },
    NodiaCvSelectionService,
    NodiaCvGenerationScope,
    NodiaCvGenerationStore,
    NodiaCvGenerationWorker,
    NodiaCvGenerationsUseCase,
    NodiaCvPdfVersionsStore,
    NodiaCvPdfRenderer,
    NodiaCvPdfVersionsUseCase,
  ],
})
export class NodiaCvModule {}
