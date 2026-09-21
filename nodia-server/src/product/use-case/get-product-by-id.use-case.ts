import { Injectable } from '@nestjs/common';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetProductByIdUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(id: string) {
    return this.productService.findOneProduct(id);
  }
}
