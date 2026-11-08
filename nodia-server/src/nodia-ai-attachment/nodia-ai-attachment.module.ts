import { NodiaAiJournalModule } from '../nodia-ai-recovery/nodia-ai-journal.module.js';
import { Module } from '@nestjs/common';
import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { ObserveNodiaAiAttachmentCapabilitiesUseCase } from './use-case/observe-nodia-ai-attachment-capabilities.use-case.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module.js';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation/nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from '../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { NodiaAiAttachment } from './entities/nodia-ai-attachment.entity.js';
import { NodiaAiAttachmentService } from './nodia-ai-attachment.service.js';
import { NodiaAiAttachmentController } from './nodia-ai-attachment.controller.js';
import { CreateNodiaAiAttachmentUseCase } from './use-case/create-nodia-ai-attachment.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from './use-case/manage-nodia-ai-attachment.use-case.js';
import { UploadNodiaAiAttachmentUseCase } from './use-case/upload-nodia-ai-attachment.use-case.js';
import { StoreNodiaAiGeneratedImageUseCase } from './use-case/store-nodia-ai-generated-image.use-case.js';
import { StorageNodiaAiAttachment } from './adapters/storage-nodia-ai-attachment.js';
import { HttpNodiaAiAttachmentInspector } from './adapters/http-nodia-ai-attachment-inspector.js';
import {
  NodiaAiAttachmentInspector,
  NodiaAiAttachmentStorage,
} from './types/attachment-ports.js';

@Module({
  imports: [
    NodiaAiJournalModule,
    NodiaAiAdapterModule,
    NodiaAiAuthorizationModule,
    NodiaAiRuntimePolicyModule,
    StorageModule,
    TypeOrmModule.forFeature([NodiaAiAttachment]),
  ],
  controllers: [NodiaAiAttachmentController],
  providers: [
    ObserveNodiaAiAttachmentCapabilitiesUseCase,
    NodiaAiConversationService,
    AuthorizeNodiaAiConversationUseCase,
    NodiaAiAttachmentService,
    CreateNodiaAiAttachmentUseCase,
    ManageNodiaAiAttachmentUseCase,
    UploadNodiaAiAttachmentUseCase,
    StoreNodiaAiGeneratedImageUseCase,
    StorageNodiaAiAttachment,
    HttpNodiaAiAttachmentInspector,
    {
      provide: NodiaAiAttachmentStorage,
      useExisting: StorageNodiaAiAttachment,
    },
    {
      provide: NodiaAiAttachmentInspector,
      useExisting: HttpNodiaAiAttachmentInspector,
    },
  ],
  exports: [
    NodiaAiAttachmentService,
    ManageNodiaAiAttachmentUseCase,
    CreateNodiaAiAttachmentUseCase,
    UploadNodiaAiAttachmentUseCase,
    StoreNodiaAiGeneratedImageUseCase,
    NodiaAiAttachmentStorage,
  ],
})
export class NodiaAiAttachmentModule {}
