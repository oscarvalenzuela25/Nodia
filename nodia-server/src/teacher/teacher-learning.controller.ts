import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { TeacherReceiptStatusInterceptor } from './teacher-receipt-status.interceptor.js';
import { TeacherLearningUseCase } from './use-case/teacher-learning.use-case.js';
import {
  LearningBlueprintDto,
  LearningMappingDto,
  LearningMetadataDto,
  LearningInteractionDto,
} from './dto/teacher-learning.dto.js';

@Controller('teacher/sessions/:id/learning')
@UseInterceptors(TeacherReceiptStatusInterceptor)
export class TeacherLearningController {
  constructor(private readonly learning: TeacherLearningUseCase) {}
  @Get() @Header('Cache-Control', 'no-store') read(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.learning.read(actorReference(r.auth), id);
  }
  @Post('diagnostic-blueprints') blueprint(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') k: string,
    @Body() b: LearningBlueprintDto,
  ) {
    return this.learning.execute(actorReference(r.auth), id, k, 'blueprint', b);
  }
  @Post('diagnostic-mappings') mapping(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') k: string,
    @Body() b: LearningMappingDto,
  ) {
    return this.learning.execute(actorReference(r.auth), id, k, 'mapping', b);
  }
  @Post('response-metadata') metadata(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') k: string,
    @Body() b: LearningMetadataDto,
  ) {
    return this.learning.execute(actorReference(r.auth), id, k, 'metadata', b);
  }
  @Post('interactions') interaction(
    @Req() r: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('idempotency-key') k: string,
    @Body() b: LearningInteractionDto,
  ) {
    return this.learning.execute(
      actorReference(r.auth),
      id,
      k,
      'interaction',
      b,
    );
  }
}
