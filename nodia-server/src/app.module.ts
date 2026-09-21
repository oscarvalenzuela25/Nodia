import { AuthModule } from './auth/auth.module.js';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { postgresConfig } from './config/db.config.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module.js';
import { RoleModule } from './role/role.module.js';
import { ActionModule } from './action/action.module.js';
import { ModuleModule } from './module/module.module.js';
import { ModuleGroupModule } from './module-group/module-group.module.js';
import { TranslationModule } from './translation/translation.module.js';
import { AuthorizationModule } from './authorization/authorization.module.js';
import { BusinessModule } from './business/business.module.js';
import { BusinessActionModule } from './business-action/business-action.module.js';
import { ProviderModule } from './provider/provider.module.js';
import { InvoiceModule } from './invoice/invoice.module.js';
import { ProductModule } from './product/product.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';
import { UserRateLimitGuard } from './rate-limit/user-rate-limit.guard.js';
import { AuthGuard } from './auth/auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresConfig),
    RedisModule,
    RateLimitModule,
    AuthModule,
    UserModule,
    RoleModule,
    ActionModule,
    BusinessActionModule,
    BusinessModule,
    ProviderModule,
    InvoiceModule,
    ProductModule,
    ModuleGroupModule,
    ModuleModule,
    TranslationModule,
    AuthorizationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Keep this order explicit: protect authentication work by IP, verify the
    // principal, then consume the verified user's quota across sessions/IPs.
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: UserRateLimitGuard },
  ],
})
export class AppModule {}
