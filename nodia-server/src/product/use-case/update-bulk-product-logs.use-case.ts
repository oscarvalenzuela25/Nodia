import { Injectable } from '@nestjs/common';
import { BulkUpdateProductLogDto } from '../dto/bulk-update-product-log.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class UpdateBulkProductLogsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(bulkDto: BulkUpdateProductLogDto) {
    return this.productService.updateBulkLogs(bulkDto);
  }
}
