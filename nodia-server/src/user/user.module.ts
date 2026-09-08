import { Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UserRole } from './entities/user-role.entity.js';
import { GetAllUsersUseCase } from './use-case/get-all-users.use-case.js';
import { CreateUserUseCase } from './use-case/create-user.use-case.js';
import { UpdateUserUseCase } from './use-case/update-user.use-case.js';
import { UserModule as UserModuleEntity } from './entities/user-module.entity.js';
import { TranslationModule } from '../translation/translation.module.js';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    GetAllUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
  ],
  imports: [
    TypeOrmModule.forFeature([User, UserRole, UserModuleEntity]),
    TranslationModule,
  ],
})
export class UserModule {}
