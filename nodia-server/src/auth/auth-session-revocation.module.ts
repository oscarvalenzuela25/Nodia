import { Module } from '@nestjs/common';
import { RevokeOwnAuthSessionUseCase } from './use-case/revoke-own-auth-session.use-case.js';

/** Local session mutation shared by HTTP authentication and the secure worker, without JWT/Google consumers. */
@Module({
  providers: [RevokeOwnAuthSessionUseCase],
  exports: [RevokeOwnAuthSessionUseCase],
})
export class AuthSessionRevocationModule {}
