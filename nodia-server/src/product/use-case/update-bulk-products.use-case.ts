import { Injectable } from '@nestjs/common';
import { BulkUpdateProductDto } from '../dto/bulk-update-product.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateBulkProductsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(bulkDto: BulkUpdateProductDto) {
    return this.productService.updateBulkProducts(bulkDto);
  }
}
