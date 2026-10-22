import { NodiaAiJournalModule } from '../nodia-ai-recovery/nodia-ai-journal.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodiaAiAuthorizationModule } from '../nodia-ai/nodia-ai-authorization.module.js';
import { NodiaAiConfirmationModule } from '../nodia-ai-confirmation/nodia-ai-confirmation.module.js';
import { NodiaAiConversation } from './entities/nodia-ai-conversation.entity.js';
import { NodiaAiMessage } from './entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from './entities/nodia-ai-message-part.entity.js';
import { NodiaAiConversationService } from './nodia-ai-conversation.service.js';
import { CreateNodiaAiConversationUseCase } from './use-case/create-nodia-ai-conversation.use-case.js';
import { ValidateNodiaAiConversationInputUseCase } from './use-case/validate-nodia-ai-conversation-input.use-case.js';
import { ValidateNodiaAiSnapshotsUseCase } from './use-case/validate-nodia-ai-snapshots.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './use-case/project-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiRunUseCase } from './use-case/project-nodia-ai-run.use-case.js';
import { AuthorizeNodiaAiConversationUseCase } from './use-case/authorize-nodia-ai-conversation.use-case.js';
import { ListNodiaAiConversationsUseCase } from './use-case/list-nodia-ai-conversations.use-case.js';
import { GetNodiaAiConversationUseCase } from './use-case/get-nodia-ai-conversation.use-case.js';
import { UpdateNodiaAiConversationUseCase } from './use-case/update-nodia-ai-conversation.use-case.js';
import { ListNodiaAiMessagesUseCase } from './use-case/list-nodia-ai-messages.use-case.js';
import { AdmitNodiaAiMessageUseCase } from './use-case/admit-nodia-ai-message.use-case.js';
import { ExpireNodiaAiConversationsUseCase } from './use-case/expire-nodia-ai-conversations.use-case.js';
import { NodiaAiConversationController } from './nodia-ai-conversation.controller.js';
import { NodiaAiRuntimePolicyModule } from '../nodia-ai-runtime/config/runtime-policy.module.js';
import { NodiaAiContextModule } from '../nodia-ai-context/nodia-ai-context.module.js';
import { NodiaAiAdapterModule } from '../nodia-ai-adapter/nodia-ai-adapter.module.js';
import { UpdateNodiaAiRoutingUseCase } from './use-case/update-nodia-ai-routing.use-case.js';
import { NodiaAiConnectionsService } from './nodia-ai-connections.service.js';
import { NodiaAiConnectionsController } from './nodia-ai-connections.controller.js';
import { ListNodiaAiConnectionsUseCase } from './use-case/list-nodia-ai-connections.use-case.js';
import { ObserveNodiaAiEligibilityUseCase } from './use-case/observe-nodia-ai-eligibility.use-case.js';
import { NodiaAiAttachmentModule } from '../nodia-ai-attachment/nodia-ai-attachment.module.js';
import {
  NODIA_AI_CONVERSATION_POLICY,
  loadNodiaAiConversationPolicy,
} from './config/conversation-policy.js';
@Module({
  imports: [
    NodiaAiJournalModule,
    NodiaAiAuthorizationModule,
    NodiaAiConfirmationModule,
    NodiaAiRuntimePolicyModule,
    NodiaAiContextModule,
    NodiaAiAdapterModule,
    NodiaAiAttachmentModule,
    TypeOrmModule.forFeature([
      NodiaAiConversation,
      NodiaAiMessage,
      NodiaAiMessagePart,
    ]),
  ],
  controllers: [NodiaAiConversationController, NodiaAiConnectionsController],
  providers: [
    NodiaAiConversationService,
    CreateNodiaAiConversationUseCase,
    ValidateNodiaAiConversationInputUseCase,
    ProjectNodiaAiConversationUseCase,
    ValidateNodiaAiSnapshotsUseCase,
    ProjectNodiaAiRunUseCase,
    AuthorizeNodiaAiConversationUseCase,
    ListNodiaAiConversationsUseCase,
    GetNodiaAiConversationUseCase,
    UpdateNodiaAiConversationUseCase,
    ListNodiaAiMessagesUseCase,
    AdmitNodiaAiMessageUseCase,
    ExpireNodiaAiConversationsUseCase,
    UpdateNodiaAiRoutingUseCase,
    NodiaAiConnectionsService,
    ListNodiaAiConnectionsUseCase,
    ObserveNodiaAiEligibilityUseCase,
    {
      provide: NODIA_AI_CONVERSATION_POLICY,
      useFactory: loadNodiaAiConversationPolicy,
    },
  ],
  exports: [
    CreateNodiaAiConversationUseCase,
    AuthorizeNodiaAiConversationUseCase,
    NodiaAiConversationService,
    ProjectNodiaAiConversationUseCase,
    ProjectNodiaAiRunUseCase,
    ExpireNodiaAiConversationsUseCase,
  ],
})
export class NodiaAiConversationModule {}
