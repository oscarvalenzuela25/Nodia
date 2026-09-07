import { Injectable } from '@nestjs/common';
import { UpdateRoleDto } from '../dto/update-role.dto.js';
import { RoleService } from '../role.service.js';

@Injectable()
export class UpdateRoleUseCase {
  constructor(private readonly roleService: RoleService) {}

  async execute(id: string, dto: UpdateRoleDto) {
    return this.roleService.update(id, dto);
  }
}
