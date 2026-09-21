import { Injectable } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateProductUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(createProductDto: CreateProductDto) {
    return this.productService.createProduct(createProductDto);
  }
}
