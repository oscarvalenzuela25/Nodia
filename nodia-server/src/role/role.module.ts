import { Module } from '@nestjs/common';
import { RoleService } from './role.service.js';
import { RoleController } from './role.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity.js';
import { RoleAction } from './entities/role-action.entity.js';
import { Action } from '../action/entities/action.entity.js';
import { GetAllRolesUseCase } from './use-case/get-all-roles.use-case.js';
import { CreateRoleUseCase } from './use-case/create-role.use-case.js';
import { UpdateRoleUseCase } from './use-case/update-role.use-case.js';

@Module({
  controllers: [RoleController],
  providers: [
    RoleService,
    GetAllRolesUseCase,
    CreateRoleUseCase,
    UpdateRoleUseCase,
  ],
  imports: [TypeOrmModule.forFeature([Role, RoleAction, Action])],
})
export class RoleModule {}
