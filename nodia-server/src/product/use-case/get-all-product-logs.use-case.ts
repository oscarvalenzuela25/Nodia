import { Injectable } from '@nestjs/common';
import { GetProductLogsDto } from '../dto/get-product-logs.dto.js';
import { ProductService } from '../product.service.js';

@Injectable()
export class GetAllProductLogsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(queryParams: GetProductLogsDto) {
    return this.productService.findAllLogs(queryParams);
  }
}
