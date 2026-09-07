import { Injectable } from '@nestjs/common';
import { GetRolesDto } from '../dto/get-roles.dto.js';
import { RoleService } from '../role.service.js';

@Injectable()
export class GetAllRolesUseCase {
  constructor(private readonly roleService: RoleService) {}

  async execute(dto: GetRolesDto) {
    return this.roleService.findAll(dto);
  }
}
