import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { GoogleIdentityService } from '../google-identity.service.js';
import { CreateSessionUseCase } from './create-session.use-case.js';
import type { LoginDto } from '../dto/login.dto.js';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly google: GoogleIdentityService,
    private readonly auth: AuthService,
    private readonly createSession: CreateSessionUseCase,
  ) {}

  async execute(dto: LoginDto) {
    if (dto.provider !== 'google')
      throw new ForbiddenException('auth:access_denied');
    const identity = await this.google.verify(dto.credential);
    return this.auth.transaction(async (manager) => {
      const user = await this.auth.findLoginUser(identity.email, manager);
      if (
        !user?.is_active ||
        (user.google_sub && user.google_sub !== identity.subject) ||
        (!user.google_sub && !identity.authoritativeEmail)
      ) {
        throw new ForbiddenException('auth:access_denied');
      }
      user.google_sub = identity.subject;
      user.name ||= identity.name ?? null;
      user.image_url ||= identity.picture ?? null;
      await this.auth.saveUser(user, manager);
      return this.createSession.execute(
        user,
        manager,
        identity.picture ?? user.image_url ?? null,
      );
    });
  }
}
