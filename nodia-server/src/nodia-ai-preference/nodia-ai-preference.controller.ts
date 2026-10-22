import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import {
  NodiaAiPreferenceOptionsDto,
  NodiaAiPreferenceQueryDto,
  PrepareNodiaAiPreferenceDto,
} from './dto/nodia-ai-preference.dto.js';
import { ListNodiaAiPreferencesUseCase } from './use-case/list-nodia-ai-preferences.use-case.js';
import { GetNodiaAiPreferenceCatalogUseCase } from './use-case/get-nodia-ai-preference-catalog.use-case.js';
import { GetNodiaAiPreferenceOptionsUseCase } from './use-case/get-nodia-ai-preference-options.use-case.js';
import { PrepareNodiaAiPreferenceUseCase } from './use-case/prepare-nodia-ai-preference.use-case.js';
@ApiTags('NodiaAI preferences')
@ApiBearerAuth()
@Controller('nodia-ai/preferences')
export class NodiaAiPreferenceController {
  constructor(
    private readonly list: ListNodiaAiPreferencesUseCase,
    private readonly catalog: GetNodiaAiPreferenceCatalogUseCase,
    private readonly options: GetNodiaAiPreferenceOptionsUseCase,
    private readonly prepare: PrepareNodiaAiPreferenceUseCase,
  ) {}
  @Get() @Header('Cache-Control', 'no-store') page(
    @Req() request: AuthRequest,
    @Query() query: NodiaAiPreferenceQueryDto,
  ) {
    return this.list.execute(actorReference(request.auth), query);
  }
  @Get('catalog') @Header('Cache-Control', 'no-store') metadata(
    @Req() request: AuthRequest,
  ) {
    return this.catalog.execute(actorReference(request.auth));
  }
  @Get('options') @Header('Cache-Control', 'no-store') choices(
    @Req() request: AuthRequest,
    @Query() query: NodiaAiPreferenceOptionsDto,
  ) {
    return this.options.execute(actorReference(request.auth), query);
  }
  @Post('prepare') @HttpCode(200) @Header('Cache-Control', 'no-store') proposal(
    @Req() request: AuthRequest,
    @Body() body: PrepareNodiaAiPreferenceDto,
  ) {
    return this.prepare.execute(actorReference(request.auth), body);
  }
}
