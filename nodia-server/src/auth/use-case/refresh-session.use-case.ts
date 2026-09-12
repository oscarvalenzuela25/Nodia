import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { AuthTokenService } from '../auth-token.service.js';
import { toAuthUser } from './create-session.use-case.js';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokenService,
  ) {}

  async execute(refreshToken?: string) {
    if (!refreshToken) throw new UnauthorizedException('auth:session_expired');
    const claims = await this.tokens.verify(refreshToken, 'refresh');
    const result = await this.auth.transaction(async (manager) => {
      const session = await this.auth.lockSession(claims.sid, manager);
      if (
        !session ||
        session.user_id !== claims.sub ||
        session.revoked_at ||
        session.expires_at <= new Date()
      )
        return null;
      const user = await this.auth.findUser(claims.sub, manager);
      if (
        !user ||
        session.refresh_token_hash !== this.tokens.hash(refreshToken)
      ) {
        // Commit revocation before throwing, including for a valid but previously rotated token.
        session.revoked_at = new Date();
        await this.auth.saveSession(session, manager);
        return null;
      }
      const issued = await this.tokens.issue(
        { ...toAuthUser(user), image_url: session.image_url },
        session.public_id,
        session.expires_at,
      );
      session.refresh_token_hash = this.tokens.hash(issued.refreshToken);
      await this.auth.saveSession(session, manager);
      return issued;
    });
    if (!result) throw new UnauthorizedException('auth:session_expired');
    return result;
  }
}
