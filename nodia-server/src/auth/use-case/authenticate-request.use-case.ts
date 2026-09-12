import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { AuthTokenService } from '../auth-token.service.js';
import { toAuthUser } from './create-session.use-case.js';
import type { AuthPrincipal } from '../types/auth.types.js';

@Injectable()
export class AuthenticateRequestUseCase {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokenService,
  ) {}

  async execute(header?: string): Promise<AuthPrincipal> {
    const match = header?.match(/^Bearer ([^\s]+)$/i);
    if (!match) throw new UnauthorizedException('auth:session_expired');
    const claims = await this.tokens.verify(match[1], 'access');
    const [session, user] = await Promise.all([
      this.auth.findActiveSession(claims.sid, claims.sub),
      this.auth.findUser(claims.sub),
    ]);
    if (!session || !user)
      throw new UnauthorizedException('auth:session_expired');
    return {
      user: { ...toAuthUser(user), image_url: session.image_url },
      sessionId: session.public_id,
    };
  }
}
