import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type {
  AuthUser,
  IssuedSession,
  TokenClaims,
} from './types/auth.types.js';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issue(
    user: AuthUser,
    sessionId: string,
    refreshExpiresAt: Date,
  ): Promise<IssuedSession> {
    const now = Math.floor(Date.now() / 1000);
    const accessExpiry = Math.min(
      now + this.config.accessSeconds,
      Math.floor(refreshExpiresAt.getTime() / 1000),
    );
    const sign = (
      tokenUse: 'access' | 'refresh',
      exp: number,
      audience: string,
    ) =>
      this.jwt.signAsync(
        { sub: user.id, sid: sessionId, token_use: tokenUse, exp },
        {
          secret: this.config.secret,
          algorithm: 'HS256',
          issuer: this.config.issuer,
          audience,
          jwtid: randomUUID(),
        },
      );
    const [token, refreshToken] = await Promise.all([
      sign('access', accessExpiry, this.config.accessAudience),
      sign(
        'refresh',
        Math.floor(refreshExpiresAt.getTime() / 1000),
        this.config.refreshAudience,
      ),
    ]);
    return {
      response: { token, expiresAt: accessExpiry * 1000, user },
      refreshToken,
      refreshExpiresAt,
    };
  }

  async verify(
    token: string,
    tokenUse: 'access' | 'refresh',
  ): Promise<TokenClaims> {
    try {
      const claims = await this.jwt.verifyAsync<TokenClaims>(token, {
        secret: this.config.secret,
        algorithms: ['HS256'],
        issuer: this.config.issuer,
        audience:
          tokenUse === 'access'
            ? this.config.accessAudience
            : this.config.refreshAudience,
      });
      if (
        claims.token_use !== tokenUse ||
        typeof claims.sub !== 'string' ||
        !/^\d+$/.test(claims.sub) ||
        typeof claims.sid !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(claims.sid) ||
        !Number.isFinite(claims.exp)
      ) {
        throw new Error('Invalid claims');
      }
      return claims;
    } catch {
      throw new UnauthorizedException('auth:session_expired');
    }
  }
}
