import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { GoogleIdentity } from './types/auth.types.js';

@Injectable()
export class GoogleIdentityService {
  private readonly logger = new Logger(GoogleIdentityService.name);
  private readonly client = new OAuth2Client();

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    // Increase clock skew tolerance from 300s (5m) to 900s (15m) to tolerate system clock drift
    (OAuth2Client as any).CLOCK_SKEW_SECS_ = 900;
  }

  async verify(credential: string): Promise<GoogleIdentity> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.config.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || (payload.email_verified !== true && (payload.email_verified as any) !== 'true')) {
        this.logger.warn(
          `Unverified Google identity: email=${payload?.email}, email_verified=${payload?.email_verified}, sub=${payload?.sub}`,
        );
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
    } catch (error: any) {
      this.logger.error(
        `Google verifyIdToken failed: ${error?.message || error}. Configured audience: "${this.config.googleClientId}"`,
        error?.stack,
      );
      throw new UnauthorizedException('auth:access_denied');
    }
  }
}
