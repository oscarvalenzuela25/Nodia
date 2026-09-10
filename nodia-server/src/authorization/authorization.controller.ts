import { Controller, Get, Headers } from '@nestjs/common';
import { GetAuthorizationContextUseCase } from './use-case/get-authorization-context.use-case.js';

@Controller('authorization')
export class AuthorizationController {
  constructor(
    private readonly getAuthorizationContextUseCase: GetAuthorizationContextUseCase,
  ) {}

  @Get('context')
  async getContext(@Headers('authorization') _authHeader?: string) {
    // TODO: In future authentication phase, extract email from Bearer token:
    // const token = _authHeader?.replace(/^Bearer\s+/i, '');
    // const payload = this.jwtService.decode(token);
    // const email = payload?.email;

    // Currently hardcoded developer email as requested:
    const developerEmail = 'oavr.18@gmail.com';

    return this.getAuthorizationContextUseCase.execute(developerEmail);
  }
}
