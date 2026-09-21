import { Injectable } from '@nestjs/common';
import { UpdateProviderDto } from '../dto/update-provider.dto.js';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class UpdateProviderUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(id: string, dto: UpdateProviderDto) {
    if (dto.name) {
      dto.name = dto.name.trim().toLowerCase();
    }
    return this.providerService.update(id, dto);
  }
}
