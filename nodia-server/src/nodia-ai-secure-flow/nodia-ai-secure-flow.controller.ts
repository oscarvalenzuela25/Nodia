import {
  Body,
  Controller,
  Get,
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
import { ManageNodiaAiSecureFlowUseCase } from './use-case/manage-nodia-ai-secure-flow.use-case.js';
import { NodiaAiSecureFlowActionDto } from './dto/nodia-ai-secure-flow.dto.js';

@ApiTags('NodiaAI secure human flows')
@ApiBearerAuth()
@Controller('nodia-ai/operations')
export class NodiaAiSecureFlowController {
  constructor(private readonly flow: ManageNodiaAiSecureFlowUseCase) {}
  @Get(':id/secure-flow')
  @Header('Cache-Control', 'no-store')
  detail(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.flow.get(actorReference(request.auth), id);
  }
  @Post(':id/secure-flow/:reference/:action')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  act(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('reference', new ParseUUIDPipe({ version: '4' })) reference: string,
    @Param('action') action: string,
    @Body() body: NodiaAiSecureFlowActionDto,
  ) {
    return this.flow.execute(
      actorReference(request.auth),
      id,
      reference,
      action,
      body,
    );
  }
}
