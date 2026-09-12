import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { GoogleIdentity } from './types/auth.types.js';

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  async verify(credential: string): Promise<GoogleIdentity> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.config.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error('Unverified identity');
      }
      return {
        subject: payload.sub,
        email: payload.email.toLowerCase().trim(),
        name: payload.name,
        picture: payload.picture?.startsWith('https://')
          ? payload.picture
          : undefined,
        authoritativeEmail:
          payload.email.toLowerCase().endsWith('@gmail.com') ||
          Boolean(payload.hd),
      };
    } catch {
      throw new UnauthorizedException('auth:access_denied');
    }
  }
}
