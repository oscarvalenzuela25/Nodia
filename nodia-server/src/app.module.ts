import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { postgresConfig } from './config/db.config.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module.js';
import { RoleModule } from './role/role.module.js';
import { ActionModule } from './action/action.module.js';
import { ModuleModule } from './module/module.module.js';
import { TranslationModule } from './translation/translation.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresConfig),
    UserModule,
    RoleModule,
    ActionModule,
    ModuleModule,
    TranslationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
