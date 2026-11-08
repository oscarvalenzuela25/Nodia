import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateProductUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    id: string,
    updateProductDto: UpdateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.updateProduct(
        id,
        updateProductDto,
        manager,
        actor,
      );
    return manager
      ? this.productService.updateProduct(id, updateProductDto, manager)
      : this.productService.updateProduct(id, updateProductDto);
  }
}
