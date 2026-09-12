import {
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticateRequestUseCase } from './use-case/authenticate-request.use-case.js';
import type { AuthRequest } from './types/auth.types.js';

const PUBLIC_ROUTE = 'auth:public';
// Every controller route is protected by APP_GUARD unless explicitly public.
// Prefer method metadata so future handlers do not inherit an exemption.
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authenticate: AuthenticateRequestUseCase,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    request.auth = await this.authenticate.execute(
      request.headers.authorization,
    );
    return true;
  }
}
