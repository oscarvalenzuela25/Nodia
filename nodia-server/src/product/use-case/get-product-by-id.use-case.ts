import type { ActorReference } from '../../authorization/authority-transaction.js';
import { Injectable } from '@nestjs/common';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetProductByIdUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(id: string, actor?: ActorReference) {
    return actor
      ? this.productService.findOneProduct(id, actor)
      : this.productService.findOneProduct(id);
  }
}
