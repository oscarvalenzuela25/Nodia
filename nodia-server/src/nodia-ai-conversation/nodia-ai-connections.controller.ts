import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { NodiaAiPageQueryDto } from './dto/nodia-ai-conversation-query.dto.js';
import { NodiaAiEligibilityQueryDto } from './dto/nodia-ai-eligibility-query.dto.js';
import { ListNodiaAiConnectionsUseCase } from './use-case/list-nodia-ai-connections.use-case.js';
import { ObserveNodiaAiEligibilityUseCase } from './use-case/observe-nodia-ai-eligibility.use-case.js';

@ApiTags('NodiaAI connections')
@ApiBearerAuth()
@Controller('nodia-ai/connections')
export class NodiaAiConnectionsController {
  constructor(
    private readonly list: ListNodiaAiConnectionsUseCase,
    private readonly observe: ObserveNodiaAiEligibilityUseCase,
  ) {}
  @Get() all(@Req() request: AuthRequest, @Query() input: NodiaAiPageQueryDto) {
    return this.list.execute(actorReference(request.auth), input);
  }
  @Get(':id/eligibility') eligibility(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Query() input: NodiaAiEligibilityQueryDto,
  ) {
    return this.observe.execute(actorReference(request.auth), id, input);
  }
}
