import {
  Body,
  Controller,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  ConfirmNodiaAiProposalDto,
  NodiaAiConfirmationChallengeDto,
} from './dto/nodia-ai-confirmation.dto.js';
import { CreateNodiaAiConfirmationChallengeUseCase } from './use-case/create-nodia-ai-confirmation-challenge.use-case.js';
import { ConfirmNodiaAiProposalUseCase } from './use-case/confirm-nodia-ai-proposal.use-case.js';
@ApiTags('NodiaAI human confirmation')
@ApiBearerAuth()
@Controller('nodia-ai/proposals')
export class NodiaAiConfirmationController {
  constructor(
    private readonly challenge: CreateNodiaAiConfirmationChallengeUseCase,
    private readonly confirm: ConfirmNodiaAiProposalUseCase,
  ) {}
  @Post(':id/confirmation-challenge')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  issuance(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: NodiaAiConfirmationChallengeDto,
  ) {
    return this.challenge.execute(actorReference(request.auth), id, body);
  }
  @Post(':id/confirm')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  confirmation(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: ConfirmNodiaAiProposalDto,
  ) {
    return this.confirm.execute(actorReference(request.auth), id, body);
  }
}
