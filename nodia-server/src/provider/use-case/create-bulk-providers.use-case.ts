import { Injectable } from '@nestjs/common';
import { BulkCreateProviderDto } from '../dto/bulk-create-provider.dto.js';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class CreateBulkProvidersUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(bulkDto: BulkCreateProviderDto) {
    if (bulkDto.items) {
      bulkDto.items.forEach((item) => {
        if (item.name) {
          item.name = item.name.trim().toLowerCase();
        }
      });
    }
    return this.providerService.createBulk(bulkDto);
  }
}
