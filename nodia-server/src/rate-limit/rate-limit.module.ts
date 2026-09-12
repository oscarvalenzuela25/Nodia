import { Module } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { envs } from '../config/envs.config.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitStorage } from './rate-limit-storage.provider.js';
import { UserRateLimitGuard } from './user-rate-limit.guard.js';
import { LOGIN_RATE_LIMIT } from './rate-limit.decorator.js';

@Module({
  providers: [RateLimitStorage],
  exports: [RateLimitStorage],
})
class RateLimitStorageModule {}

const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const skipReads = (context: ExecutionContext) =>
  !writeMethods.has(context.switchToHttp().getRequest<Request>().method);

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RateLimitStorageModule],
      inject: [RateLimitStorage, Reflector],
      useFactory: (storage: RateLimitStorage, reflector: Reflector) => ({
        storage,
        throttlers: [
          { name: 'burst', ...envs.RATE_LIMIT.burst },
          { name: 'general', ...envs.RATE_LIMIT.general },
          {
            name: 'writes',
            ...envs.RATE_LIMIT.writes,
            skipIf: skipReads,
          },
          {
            name: 'login',
            ...envs.RATE_LIMIT.login,
            skipIf: (context: ExecutionContext) =>
              !reflector.get<boolean>(LOGIN_RATE_LIMIT, context.getHandler()),
          },
          { name: 'user', ...envs.RATE_LIMIT.user },
          {
            name: 'userWrites',
            ...envs.RATE_LIMIT.userWrites,
            skipIf: skipReads,
          },
        ],
      }),
    }),
  ],
  providers: [RateLimitGuard, UserRateLimitGuard],
  exports: [RateLimitGuard, UserRateLimitGuard],
})
export class RateLimitModule {}
