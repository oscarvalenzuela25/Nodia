import { Injectable } from '@nestjs/common';
import { BulkCreateProductLogDto } from '../dto/bulk-create-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class CreateBulkProductLogsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(bulkDto: BulkCreateProductLogDto) {
    return this.productService.createBulkLogs(bulkDto);
  }
}
