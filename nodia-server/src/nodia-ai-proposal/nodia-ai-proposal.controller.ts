import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { GetNodiaAiProposalUseCase } from './use-case/get-nodia-ai-proposal.use-case.js';
import { UpdateNodiaAiProposalUseCase } from './use-case/update-nodia-ai-proposal.use-case.js';
import { CancelNodiaAiProposalUseCase } from './use-case/cancel-nodia-ai-proposal.use-case.js';
import {
  CancelNodiaAiProposalDto,
  NodiaAiProposalQueryDto,
  UpdateNodiaAiProposalDto,
} from './dto/nodia-ai-proposal.dto.js';
@ApiTags('NodiaAI proposals')
@ApiBearerAuth()
@Controller('nodia-ai/proposals')
export class NodiaAiProposalController {
  constructor(
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly update: UpdateNodiaAiProposalUseCase,
    private readonly cancel: CancelNodiaAiProposalUseCase,
  ) {}
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: NodiaAiProposalQueryDto,
  ) {
    return this.get.execute(actorReference(request.auth), id, query.revision);
  }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  edit(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateNodiaAiProposalDto,
  ) {
    return this.update.execute(actorReference(request.auth), id, body);
  }
  @Post(':id/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancellation(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: CancelNodiaAiProposalDto,
  ) {
    return this.cancel.execute(actorReference(request.auth), id, body);
  }
}
