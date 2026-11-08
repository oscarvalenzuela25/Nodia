import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { GetProductsDto } from '../dto/get-products.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetAllProductsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(queryParams: GetProductsDto, actor?: ActorReference) {
    return actor
      ? this.productService.findAllProducts(queryParams, undefined, actor)
      : this.productService.findAllProducts(queryParams);
  }
}
