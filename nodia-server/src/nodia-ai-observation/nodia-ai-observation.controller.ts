import { Controller, Get, Header, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { NodiaAiPageQueryDto } from '../nodia-ai-conversation/dto/nodia-ai-conversation-query.dto.js';
import { ObserveNodiaAiRunUseCase } from './use-case/observe-nodia-ai-run.use-case.js';
import { GetNodiaAiToolResultUseCase } from './use-case/get-nodia-ai-tool-result.use-case.js';

@ApiTags('NodiaAI observation')
@ApiBearerAuth()
@Controller('nodia-ai')
export class NodiaAiObservationController {
  constructor(
    private readonly runs: ObserveNodiaAiRunUseCase,
    private readonly results: GetNodiaAiToolResultUseCase,
  ) {}
  @Get('runs/:id')
  @Header('Cache-Control', 'no-store')
  summary(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.runs.summary(actorReference(request.auth), id);
  }
  @Get('runs/:id/events')
  @Header('Cache-Control', 'no-store')
  events(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Query() query: NodiaAiPageQueryDto,
  ) {
    return this.runs.events(actorReference(request.auth), id, query);
  }
  @Get('tool-calls/:id/result')
  @Header('Cache-Control', 'no-store')
  result(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.results.execute(actorReference(request.auth), id);
  }
  @Get('tool-calls/:id/observation')
  @Header('Cache-Control', 'no-store')
  observation(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.results.observe(actorReference(request.auth), id);
  }
}
