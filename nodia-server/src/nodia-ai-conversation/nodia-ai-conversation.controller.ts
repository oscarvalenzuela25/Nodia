import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { CreateNodiaAiConversationDto } from './dto/create-nodia-ai-conversation.dto.js';
import { UpdateNodiaAiConversationDto } from './dto/update-nodia-ai-conversation.dto.js';
import { UpdateNodiaAiSelectionDto } from './dto/update-nodia-ai-selection.dto.js';
import { CreateNodiaAiMessageDto } from './dto/create-nodia-ai-message.dto.js';
import {
  NodiaAiConversationListQueryDto,
  NodiaAiMessageListQueryDto,
} from './dto/nodia-ai-conversation-query.dto.js';
import { CreateNodiaAiConversationUseCase } from './use-case/create-nodia-ai-conversation.use-case.js';
import { ListNodiaAiConversationsUseCase } from './use-case/list-nodia-ai-conversations.use-case.js';
import { GetNodiaAiConversationUseCase } from './use-case/get-nodia-ai-conversation.use-case.js';
import { UpdateNodiaAiConversationUseCase } from './use-case/update-nodia-ai-conversation.use-case.js';
import { ListNodiaAiMessagesUseCase } from './use-case/list-nodia-ai-messages.use-case.js';
import { AdmitNodiaAiMessageUseCase } from './use-case/admit-nodia-ai-message.use-case.js';
import { UpdateNodiaAiRoutingUseCase } from './use-case/update-nodia-ai-routing.use-case.js';
import { UpdateNodiaAiRoutingDto } from './dto/nodia-ai-routing.dto.js';

@ApiTags('NodiaAI conversations')
@ApiBearerAuth()
@ApiBadRequestResponse({ description: 'nodia_ai:invalid_input' })
@ApiNotFoundResponse({ description: 'nodia_ai:conversation_not_found' })
@ApiGoneResponse({
  description: 'nodia_ai:conversation_expired (own known chat only)',
})
@ApiConflictResponse({
  description:
    'nodia_ai:revision_conflict / conversation_busy / request_conflict',
})
@Controller('nodia-ai/conversations')
export class NodiaAiConversationController {
  constructor(
    private readonly createChat: CreateNodiaAiConversationUseCase,
    private readonly listChats: ListNodiaAiConversationsUseCase,
    private readonly getChat: GetNodiaAiConversationUseCase,
    private readonly updateChat: UpdateNodiaAiConversationUseCase,
    private readonly listMessages: ListNodiaAiMessagesUseCase,
    private readonly admitMessage: AdmitNodiaAiMessageUseCase,
    private readonly updateRouting: UpdateNodiaAiRoutingUseCase,
  ) {}
  @Post() create(
    @Req() request: AuthRequest,
    @Body() input: CreateNodiaAiConversationDto,
  ) {
    return this.createChat.execute(actorReference(request.auth), input);
  }
  @Get() list(
    @Req() request: AuthRequest,
    @Query() input: NodiaAiConversationListQueryDto,
  ) {
    return this.listChats.execute(actorReference(request.auth), input);
  }
  @Get(':id') detail(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.getChat.execute(actorReference(request.auth), id);
  }
  @Patch(':id') update(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateNodiaAiConversationDto,
  ) {
    return this.updateChat.execute(actorReference(request.auth), id, input);
  }
  @Patch(':id/selection') selection(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateNodiaAiSelectionDto,
  ) {
    return this.updateChat.selection(actorReference(request.auth), id, input);
  }
  @Patch(':id/routing') routing(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: UpdateNodiaAiRoutingDto,
  ) {
    return this.updateRouting.execute(actorReference(request.auth), id, input);
  }
  @Get(':id/messages') messages(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() input: NodiaAiMessageListQueryDto,
  ) {
    return this.listMessages.execute(actorReference(request.auth), id, input);
  }
  @Post(':id/messages')
  @HttpCode(202)
  @ApiAcceptedResponse({
    description: 'Durably admitted message and run, not provider completion.',
  })
  @ApiTooManyRequestsResponse({ description: 'nodia_ai:execution_limit' })
  message(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: CreateNodiaAiMessageDto,
  ) {
    return this.admitMessage.execute(actorReference(request.auth), id, input);
  }
}
