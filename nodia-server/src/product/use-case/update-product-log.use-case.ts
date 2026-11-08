import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { UpdateProductLogDto } from '../dto/update-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateProductLogUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    id: string,
    updateProductLogDto: UpdateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.updateLog(
        id,
        updateProductLogDto,
        manager,
        actor,
      );
    return manager
      ? this.productService.updateLog(id, updateProductLogDto, manager)
      : this.productService.updateLog(id, updateProductLogDto);
  }
}
