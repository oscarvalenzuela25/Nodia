import {
  Controller,
  Body,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Req,
  Post,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { GetNodiaAiExecutionUseCase } from './use-case/get-nodia-ai-execution.use-case.js';
import { ControlNodiaAiExecutionUseCase } from './use-case/control-nodia-ai-execution.use-case.js';
import { NodiaAiExecutionControlDto } from './dto/nodia-ai-confirmation.dto.js';
@ApiTags('NodiaAI operations')
@ApiBearerAuth()
@Controller('nodia-ai/operations')
export class NodiaAiOperationController {
  constructor(
    private readonly get: GetNodiaAiExecutionUseCase,
    private readonly control: ControlNodiaAiExecutionUseCase,
  ) {}
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.get.execute(actorReference(request.auth), id);
  }
  @Post(':id/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancel(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: NodiaAiExecutionControlDto,
  ) {
    return this.control.execute(
      actorReference(request.auth),
      id,
      body,
      'cancel',
    );
  }
  @Post(':id/resume')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  resume(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: NodiaAiExecutionControlDto,
  ) {
    return this.control.execute(
      actorReference(request.auth),
      id,
      body,
      'resume',
    );
  }
}
