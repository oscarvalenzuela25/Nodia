import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { AuthTokenService } from '../auth-token.service.js';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokenService,
  ) {}

  async execute(refreshToken?: string) {
    if (!refreshToken) return;
    let claims;
    try {
      claims = await this.tokens.verify(refreshToken, 'refresh');
    } catch (error) {
      if (error instanceof UnauthorizedException) return;
      throw error;
    }
    await this.auth.revokeSession(claims.sid, claims.sub);
  }
}
