import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAllProductLogsUseCase } from './get-all-product-logs.use-case.js';
import type { ProductService } from '../product.service.js';
import type { GetProductLogsDto } from '../dto/get-product-logs.dto.js';

describe('GetAllProductLogsUseCase', () => {
  let useCase: GetAllProductLogsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      findAllLogs: vi.fn(),
    };
    useCase = new GetAllProductLogsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.findAllLogs with queryParams and return result', async () => {
    const queryParams: GetProductLogsDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse = {
      data: [
        {
          id: '265bf029-7b3b-4ce4-82ee-c61ecba01c71',
          product_id: '1',
          code: 'PROD-001',
          name: 'Coca Cola 1.5L',
          cost_price: 1000,
          cost_price_tax: 190,
          profit_percentage: 30,
          sale_price: 1547,
          stock: 50,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(productServiceMock.findAllLogs!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(queryParams);

    expect(productServiceMock.findAllLogs).toHaveBeenCalledTimes(1);
    expect(productServiceMock.findAllLogs).toHaveBeenCalledWith(queryParams);
    expect(result).toEqual(mockResponse);
  });
});
