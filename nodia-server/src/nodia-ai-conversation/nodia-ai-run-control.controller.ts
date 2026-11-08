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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { CancelNodiaAiRunDto } from './dto/cancel-nodia-ai-run.dto.js';
import { CancelNodiaAiRunUseCase } from './use-case/cancel-nodia-ai-run.use-case.js';

@ApiTags('NodiaAI run control')
@ApiBearerAuth()
@Controller('nodia-ai/runs')
export class NodiaAiRunControlController {
  constructor(private readonly cancelRun: CancelNodiaAiRunUseCase) {}

  @Post(':id/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    description:
      'Durable stop intent or current terminal state; not proof of native closure.',
  })
  cancel(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: CancelNodiaAiRunDto,
  ) {
    return this.cancelRun.execute(actorReference(request.auth), id, input);
  }
}
