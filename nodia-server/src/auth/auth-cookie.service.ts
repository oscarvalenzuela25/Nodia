import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { IssuedSession } from './types/auth.types.js';

@Injectable()
export class AuthCookieService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  read(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[this.config.cookieName];
    return typeof token === 'string' ? token : undefined;
  }

  private options() {
    return {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      path: this.config.cookiePath,
    };
  }

  write(response: Response, issued: IssuedSession) {
    response.cookie(this.config.cookieName, issued.refreshToken, {
      ...this.options(),
      expires: issued.refreshExpiresAt,
    });
    return issued.response;
  }

  clear(response: Response) {
    response.clearCookie(this.config.cookieName, this.options());
  }
}
