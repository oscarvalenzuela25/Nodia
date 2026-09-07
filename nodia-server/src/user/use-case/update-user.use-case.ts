import { Injectable } from '@nestjs/common';
import { UpdateUserDto } from '../dto/update-user.dto.js';
import { UserService } from '../user.service.js';

@Injectable()
export class UpdateUserUseCase {
  constructor(private readonly userService: UserService) {}

  async execute(id: string, dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }
}
