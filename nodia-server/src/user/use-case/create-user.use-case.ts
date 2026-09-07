import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { UserService } from '../user.service.js';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly userService: UserService) {}

  async execute(dto: CreateUserDto) {
    return this.userService.create(dto);
  }
}
