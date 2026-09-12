import { Controller, Get, Header, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { GetAuthorizationContextUseCase } from './use-case/get-authorization-context.use-case.js';

@ApiBearerAuth()
@Controller('authorization')
export class AuthorizationController {
  constructor(private readonly getAuthorizationContextUseCase: GetAuthorizationContextUseCase) {}

  @Get('context')
  @Header('Cache-Control', 'no-store')
  getContext(@Req() request: AuthRequest) {
    return this.getAuthorizationContextUseCase.execute(request.auth.user.email);
  }
}
