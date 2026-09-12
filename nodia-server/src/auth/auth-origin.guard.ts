import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      !request.headers.origin ||
      !this.config.origins.includes(request.headers.origin)
    ) {
      throw new ForbiddenException('auth:invalid_origin');
    }
    return true;
  }
}
