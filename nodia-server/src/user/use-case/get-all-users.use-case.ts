import { Injectable } from '@nestjs/common';
import { GetUsersDto } from '../dto/get-users.dto.js';
import { UserService } from '../user.service.js';

@Injectable()
export class GetAllUsersUseCase {
  constructor(private readonly userService: UserService) {}

  async execute(dto: GetUsersDto) {
    return this.userService.findAll(dto);
  }
}
