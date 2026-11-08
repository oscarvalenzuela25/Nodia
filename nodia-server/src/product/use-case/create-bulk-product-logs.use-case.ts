import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { BulkCreateProductLogDto } from '../dto/bulk-create-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateBulkProductLogsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    bulkDto: BulkCreateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.createBulkLogs(bulkDto, manager, actor);
    return this.productService.createBulkLogs(bulkDto);
  }
}
