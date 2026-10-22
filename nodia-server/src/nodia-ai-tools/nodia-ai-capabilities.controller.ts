import { Controller, Get, Header, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  NodiaAiCapabilitiesQueryDto,
  NodiaAiCapabilityVersionQueryDto,
} from './dto/nodia-ai-capabilities-query.dto.js';
import { QueryNodiaAiCapabilitiesUseCase } from './use-case/query-nodia-ai-capabilities.use-case.js';

@ApiTags('NodiaAI capabilities')
@ApiBearerAuth()
@Controller('nodia-ai/capabilities')
export class NodiaAiCapabilitiesController {
  constructor(private readonly query: QueryNodiaAiCapabilitiesUseCase) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  search(
    @Req() request: AuthRequest,
    @Query() input: NodiaAiCapabilitiesQueryDto,
  ) {
    return this.query.execute(actorReference(request.auth), 'search', input);
  }
  @Get(':name')
  @Header('Cache-Control', 'no-store')
  describe(
    @Req() request: AuthRequest,
    @Param('name') name: string,
    @Query() input: NodiaAiCapabilityVersionQueryDto,
  ) {
    return this.query.execute(
      actorReference(request.auth),
      'describe',
      input,
      name,
    );
  }
  @Get(':name/schema')
  @Header('Cache-Control', 'no-store')
  schema(
    @Req() request: AuthRequest,
    @Param('name') name: string,
    @Query() input: NodiaAiCapabilityVersionQueryDto,
  ) {
    return this.query.execute(
      actorReference(request.auth),
      'schema',
      input,
      name,
    );
  }
}
