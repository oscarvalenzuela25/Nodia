import { Injectable, type ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../auth/types/auth.types.js';
import { RateLimitGuard } from './rate-limit.guard.js';

@Injectable()
export class UserRateLimitGuard extends RateLimitGuard {
  protected override readonly policyNames = ['user', 'userWrites'];

  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Partial<AuthRequest>>();
    return (await super.shouldSkip(context)) || !request.auth;
  }

  protected override async getTracker(request: AuthRequest): Promise<string> {
    // AuthGuard has verified the JWT, active session and user before this guard.
    // Token rotation, a new session or a different IP must not reset this quota.
    return `user:${request.auth.user.id}`;
  }
}
