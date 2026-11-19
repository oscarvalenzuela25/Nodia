import { Injectable } from '@nestjs/common';
import type { ListNewsDto } from '../dto/list-news.dto.js';
import type { NewsListResponse } from '../news.types.js';

@Injectable()
export class ListNewsUseCase {
  execute({ page = 1, limit = 20 }: ListNewsDto): NewsListResponse {
    return {
      items: [],
      sources: [],
      pagination: { page, limit, total: 0, total_pages: 0 },
    };
  }
}
