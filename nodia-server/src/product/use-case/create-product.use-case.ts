import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateProductUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    createProductDto: CreateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.createProduct(
        createProductDto,
        manager,
        actor,
      );
    return manager
      ? this.productService.createProduct(createProductDto, manager)
      : this.productService.createProduct(createProductDto);
  }
}
