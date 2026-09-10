import { Module } from '@nestjs/common';
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
import { RedisModule } from './common/redis/redis.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresConfig),
    RedisModule,
    UserModule,
    RoleModule,
    ActionModule,
    ModuleGroupModule,
    ModuleModule,
    TranslationModule,
    AuthorizationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
