import { Injectable } from '@nestjs/common';
import { GetProductsDto } from '../dto/get-products.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetAllProductsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(queryParams: GetProductsDto) {
    return this.productService.findAllProducts(queryParams);
  }
}
