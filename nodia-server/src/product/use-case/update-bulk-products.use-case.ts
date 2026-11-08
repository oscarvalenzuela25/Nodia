import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { BulkUpdateProductDto } from '../dto/bulk-update-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateBulkProductsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    bulkDto: BulkUpdateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.updateBulkProducts(bulkDto, manager, actor);
    return manager
      ? this.productService.updateBulkProducts(bulkDto, manager)
      : this.productService.updateBulkProducts(bulkDto);
  }
}
