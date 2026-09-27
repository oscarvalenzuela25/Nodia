import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryProductLogsUseCase } from './query-product-logs.use-case.js';
import type { ProductService } from '../product.service.js';
import type { QueryProductLogsDto } from '../dto/query-product-logs.dto.js';

describe('QueryProductLogsUseCase', () => {
  let useCase: QueryProductLogsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      findAllLogs: vi.fn(),
    };
    useCase = new QueryProductLogsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should map product_ids, codes, s, and call productService.findAllLogs', async () => {
    const dto: QueryProductLogsDto = {
      product_ids: ['55', '62'],
      codes: ['PROD-001'],
      s: 'created_at desc',
      all: true,
      page: 1,
      limit: 25,
      includes: false,
    };

    const mockResponse = {
      data: [
        {
          id: 'log-1',
          product_id: '55',
          code: 'PROD-001',
          name: 'Producto A',
          cost_price: 1000,
          cost_price_tax: 1190,
          profit_percentage: 30,
          sale_price: 1547,
          stock: 50,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 1,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(productServiceMock.findAllLogs!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(dto);

    expect(productServiceMock.findAllLogs).toHaveBeenCalledTimes(1);
    expect(productServiceMock.findAllLogs).toHaveBeenCalledWith({
      page: 1,
      limit: 25,
      all: true,
      includes: false,
      q: {
        product_id_in: ['55', '62'],
        code_in: ['PROD-001'],
        s: 'created_at desc',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  it('should apply defaults when options are not provided', async () => {
    const dto: QueryProductLogsDto = {};

    vi.mocked(productServiceMock.findAllLogs!).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    } as any);

    await useCase.execute(dto);

    expect(productServiceMock.findAllLogs).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      all: false,
      includes: true,
      q: {},
    });
  });
});
