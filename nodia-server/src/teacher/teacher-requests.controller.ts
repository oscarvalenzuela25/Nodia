import {
  Controller,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { actorReference } from '../authorization/authority-transaction.js';
import { ExecuteTeacherCommandUseCase } from './use-case/execute-teacher-command.use-case.js';

@Controller('teacher/requests')
export class TeacherRequestsController {
  constructor(private readonly command: ExecuteTeacherCommandUseCase) {}

  @Post(':requestKey/close')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  close(
    @Req() request: AuthRequest,
    @Param('requestKey', ParseUUIDPipe) key: string,
  ) {
    return this.command.closeRequest(actorReference(request.auth), key);
  }
}
