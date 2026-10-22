import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { GetRolesDto } from '../dto/get-roles.dto.js';
import { RoleService } from '../role.service.js';

@Injectable()
export class GetAllRolesUseCase {
  constructor(private readonly roleService: RoleService) {}

  async execute(dto: GetRolesDto, manager?: EntityManager) {
    return manager
      ? this.roleService.findAll(dto, manager)
      : this.roleService.findAll(dto);
  }
}
