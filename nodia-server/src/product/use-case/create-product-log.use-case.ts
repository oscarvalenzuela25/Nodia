import type { ActorReference } from '../../authorization/authority-transaction.js';
import type { EntityManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CreateProductLogDto } from '../dto/create-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateProductLogUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(
    createProductLogDto: CreateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ) {
    if (actor)
      return this.productService.createLog(createProductLogDto, manager, actor);
    return manager
      ? this.productService.createLog(createProductLogDto, manager)
      : this.productService.createLog(createProductLogDto);
  }
}
