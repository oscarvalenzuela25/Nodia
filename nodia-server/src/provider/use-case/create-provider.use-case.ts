import { Injectable } from '@nestjs/common';
import { CreateProviderDto } from '../dto/create-provider.dto.js';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class CreateProviderUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(dto: CreateProviderDto) {
    if (dto.name) {
      dto.name = dto.name.trim().toLowerCase();
    }
    return this.providerService.create(dto);
  }
}
