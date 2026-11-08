import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { BulkUpdateProductLogDto } from '../dto/bulk-update-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateBulkProductLogsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    bulkDto: BulkUpdateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.updateBulkLogs(bulkDto, manager, actor);
    return this.productService.updateBulkLogs(bulkDto);
  }
}
