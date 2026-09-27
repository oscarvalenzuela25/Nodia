import { Injectable } from '@nestjs/common';
import { QueryProductLogsDto } from '../dto/query-product-logs.dto.js';
import { ProductService } from '../product.service.js';
import { FilterProductLogDto } from '../dto/filter-product-log.dto.js';

@Injectable()
export class QueryProductLogsUseCase {
  constructor(private readonly productService: ProductService) {}

  async execute(dto: QueryProductLogsDto) {
    const q: FilterProductLogDto = { ...dto.q };

    if (dto.product_ids && dto.product_ids.length > 0) {
      q.product_id_in = dto.product_ids;
    }

    if (dto.codes && dto.codes.length > 0) {
      q.code_in = dto.codes;
    }

    if (dto.s) {
      q.s = dto.s;
    }

    return this.productService.findAllLogs({
      page: dto.page ?? 1,
      limit: dto.limit ?? 10,
      all: dto.all ?? false,
      includes: dto.includes ?? true,
      q,
    });
  }
}
