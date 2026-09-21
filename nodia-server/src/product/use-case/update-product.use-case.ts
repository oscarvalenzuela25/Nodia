import { Injectable } from '@nestjs/common';
import { UpdateProductDto } from '../dto/update-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateProductUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(id: string, updateProductDto: UpdateProductDto) {
    return this.productService.updateProduct(id, updateProductDto);
  }
}
