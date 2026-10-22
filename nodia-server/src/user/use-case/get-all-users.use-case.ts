import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { GetUsersDto } from '../dto/get-users.dto.js';
import { UserService } from '../user.service.js';

@Injectable()
export class GetAllUsersUseCase {
  constructor(private readonly userService: UserService) {}

  async execute(dto: GetUsersDto, manager?: EntityManager) {
    return manager
      ? this.userService.findAll(dto, manager)
      : this.userService.findAll(dto);
  }
}
