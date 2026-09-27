import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { GoogleIdentityService } from '../google-identity.service.js';
import { CreateSessionUseCase } from './create-session.use-case.js';
import type { LoginDto } from '../dto/login.dto.js';

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    private readonly google: GoogleIdentityService,
    private readonly auth: AuthService,
    private readonly createSession: CreateSessionUseCase,
  ) {}

  async execute(dto: LoginDto) {
    if (dto.provider !== 'google') {
      this.logger.warn(`Rejected login attempt: provider "${dto.provider}" is not "google"`);
      throw new ForbiddenException('auth:access_denied');
    }
    const identity = await this.google.verify(dto.credential);
    return this.auth.transaction(async (manager) => {
      const user = await this.auth.findLoginUser(identity.email, manager);
      if (!user) {
        this.logger.warn(`Rejected login: user with email "${identity.email}" not found in database`);
        throw new ForbiddenException('auth:access_denied');
      }
      if (!user.is_active) {
        this.logger.warn(`Rejected login: user "${identity.email}" is inactive`);
        throw new ForbiddenException('auth:access_denied');
      }
      if (user.google_sub && user.google_sub !== identity.subject) {
        this.logger.warn(`Rejected login: google_sub mismatch for "${identity.email}"`);
        throw new ForbiddenException('auth:access_denied');
      }
      if (!user.google_sub && !identity.authoritativeEmail) {
        this.logger.warn(`Rejected login: unlinked non-authoritative email "${identity.email}"`);
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
