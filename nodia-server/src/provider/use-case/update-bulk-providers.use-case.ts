import { Injectable } from '@nestjs/common';
import { BulkUpdateProviderDto } from '../dto/bulk-update-provider.dto.js';
import { ProviderService } from '../provider.service.js';

@Injectable()
export class UpdateBulkProvidersUseCase {
  constructor(private readonly providerService: ProviderService) {}

  async execute(bulkDto: BulkUpdateProviderDto) {
    if (bulkDto.items) {
      bulkDto.items.forEach((item) => {
        if (item.name) {
          item.name = item.name.trim().toLowerCase();
        }
      });
    }
    return this.providerService.updateBulk(bulkDto);
  }
}
