import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { TeacherReceiptStatusInterceptor } from './teacher-receipt-status.interceptor.js';
import {
  TeacherEnrichmentCommandDto,
  TeacherEnrichmentConceptQueryDto,
} from './dto/teacher-enrichment.dto.js';
import { TeacherEnrichmentUseCase } from './use-case/teacher-enrichment.use-case.js';

@Controller('teacher/sessions/:id/enrichment')
@UseInterceptors(TeacherReceiptStatusInterceptor)
export class TeacherEnrichmentController {
  constructor(private readonly enrichment: TeacherEnrichmentUseCase) {}
  @Get() @Header('Cache-Control', 'no-store') dashboard(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return this.enrichment.dashboard(actorReference(r.auth), id, page);
  }
  @Get('threads/:threadId') @Header('Cache-Control', 'no-store') thread(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    return this.enrichment.thread(actorReference(r.auth), id, threadId);
  }
  @Get('concepts') @Header('Cache-Control', 'no-store') concepts(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TeacherEnrichmentConceptQueryDto,
  ) {
    return this.enrichment.concepts(
      actorReference(r.auth),
      id,
      query.page,
      query.q,
    );
  }
  @Get('sources/:sourceId') @Header('Cache-Control', 'no-store') source(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sourceId', ParseUUIDPipe) sourceId: string,
  ) {
    return this.enrichment.source(actorReference(r.auth), id, sourceId);
  }
  @Get('concepts/:conceptId') @Header('Cache-Control', 'no-store') concept(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('conceptId', ParseUUIDPipe) conceptId: string,
  ) {
    return this.enrichment.concept(actorReference(r.auth), id, conceptId);
  }
  @Post('commands') @HttpCode(200) command(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string,
    @Body() body: TeacherEnrichmentCommandDto,
  ) {
    return this.enrichment.execute(actorReference(r.auth), id, key, body);
  }
}
