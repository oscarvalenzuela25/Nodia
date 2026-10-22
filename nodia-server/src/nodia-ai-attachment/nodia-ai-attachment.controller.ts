import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  CreateNodiaAiAttachmentDto,
  ReviewNodiaAiAttachmentDto,
} from './dto/nodia-ai-attachment.dto.js';
import { CreateNodiaAiAttachmentUseCase } from './use-case/create-nodia-ai-attachment.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from './use-case/manage-nodia-ai-attachment.use-case.js';
import { UploadNodiaAiAttachmentUseCase } from './use-case/upload-nodia-ai-attachment.use-case.js';
import { ObserveNodiaAiAttachmentCapabilitiesUseCase } from './use-case/observe-nodia-ai-attachment-capabilities.use-case.js';

@ApiTags('NodiaAI attachments')
@ApiBearerAuth()
@Controller('nodia-ai/attachments')
export class NodiaAiAttachmentController {
  constructor(
    private readonly createAttachment: CreateNodiaAiAttachmentUseCase,
    private readonly manage: ManageNodiaAiAttachmentUseCase,
    private readonly uploadAttachment: UploadNodiaAiAttachmentUseCase,
    private readonly observeCapabilities: ObserveNodiaAiAttachmentCapabilitiesUseCase,
  ) {}
  @Get('capabilities') capabilities(@Req() request: AuthRequest, @Query('conversation_id') chatId?: string) {
    return this.observeCapabilities.execute(actorReference(request.auth), chatId);
  }
  @Post() create(
    @Req() request: AuthRequest,
    @Body() input: CreateNodiaAiAttachmentDto,
  ) {
    return this.createAttachment.execute(actorReference(request.auth), input);
  }
  @Get(':id') get(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.manage.get(actorReference(request.auth), id);
  }
  @Put(':id/content')
  @ApiConsumes('application/octet-stream')
  upload(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.uploadAttachment.execute(
      actorReference(request.auth),
      id,
      request,
      request.headers['content-type'],
      request.headers['content-length'],
    );
  }
  @Get(':id/content') async content(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.manage.content(actorReference(request.auth), id);
    response.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
    });
    return new StreamableFile(file.buffer, {
      type: file.media_type,
      length: file.buffer.byteLength,
    });
  }
  @Patch(':id/interpretation') review(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: ReviewNodiaAiAttachmentDto,
  ) {
    return this.manage.review(actorReference(request.auth), id, input);
  }
  @Delete(':id') discard(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.manage.discard(actorReference(request.auth), id);
  }
}
