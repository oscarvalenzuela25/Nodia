import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AUTH_CONFIG, type AuthConfig } from '../auth.config.js';
import { AuthService } from '../auth.service.js';
import { AuthTokenService } from '../auth-token.service.js';
import type { User } from '../../user/entities/user.entity.js';
import type { AuthUser } from '../types/auth.types.js';

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email,
    image_url: user.image_url ?? null,
  };
}

@Injectable()
export class CreateSessionUseCase {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: AuthTokenService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async execute(
    user: User,
    manager: EntityManager,
    imageUrl = user.image_url ?? null,
  ) {
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.config.refreshSeconds * 1000);
    const issued = await this.tokens.issue(
      { ...toAuthUser(user), image_url: imageUrl },
      sessionId,
      expiresAt,
    );
    await this.auth.saveSession(
      {
        public_id: sessionId,
        user_id: user.id,
        expires_at: expiresAt,
        image_url: imageUrl,
        refresh_token_hash: this.tokens.hash(issued.refreshToken),
        revoked_at: null,
      },
      manager,
    );
    return issued;
  }
}
