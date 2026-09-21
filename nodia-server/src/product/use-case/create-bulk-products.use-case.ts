import { Injectable } from '@nestjs/common';
import { BulkCreateProductDto } from '../dto/bulk-create-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateBulkProductsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(bulkDto: BulkCreateProductDto) {
    return this.productService.createBulkProducts(bulkDto);
  }
}
