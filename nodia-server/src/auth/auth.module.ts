import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { AUTH_CONFIG, readAuthConfig } from './auth.config.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { GoogleIdentityService } from './google-identity.service.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { AuthGuard } from './auth.guard.js';
import { LoginUseCase } from './use-case/login.use-case.js';
import { CreateSessionUseCase } from './use-case/create-session.use-case.js';
import { RefreshSessionUseCase } from './use-case/refresh-session.use-case.js';
import { LogoutUseCase } from './use-case/logout.use-case.js';
import { AuthenticateRequestUseCase } from './use-case/authenticate-request.use-case.js';
import { SeedAuthUseCase } from './use-case/seed-auth.use-case.js';
import { Role } from '../role/entities/role.entity.js';
import { ModuleGroup } from '../module-group/entities/module-group.entity.js';
import { Module as ModuleEntity } from '../module/entities/module.entity.js';
import { UserRole } from '../user/entities/user-role.entity.js';
import { UserModule as UserModuleEntity } from '../user/entities/user-module.entity.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      User,
      AuthSession,
      Role,
      ModuleGroup,
      ModuleEntity,
      UserRole,
      UserModuleEntity,
    ]),
    TranslationModule,
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => readAuthConfig(process.env) },
    AuthService,
    AuthTokenService,
    GoogleIdentityService,
    AuthCookieService,
    AuthOriginGuard,
    LoginUseCase,
    CreateSessionUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    AuthenticateRequestUseCase,
    SeedAuthUseCase,
    AuthGuard,
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
