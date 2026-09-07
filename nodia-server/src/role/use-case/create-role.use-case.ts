import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from '../dto/create-role.dto.js';
import { RoleService } from '../role.service.js';

@Injectable()
export class CreateRoleUseCase {
  constructor(private readonly roleService: RoleService) {}

  async execute(dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }
}
