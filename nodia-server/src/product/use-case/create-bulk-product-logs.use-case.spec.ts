import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBulkProductLogsUseCase } from './create-bulk-product-logs.use-case.js';
import type { ProductService } from '../product.service.js';
import type { BulkCreateProductLogDto } from '../dto/bulk-create-product-log.dto.js';

describe('CreateBulkProductLogsUseCase', () => {
  let useCase: CreateBulkProductLogsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      createBulkLogs: vi.fn(),
    };
    useCase = new CreateBulkProductLogsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.createBulkLogs with bulkDto and return created logs', async () => {
    const bulkDto: BulkCreateProductLogDto = {
      items: [
        {
          product_id: '1',
          code: 'PROD-001',
          name: 'Coca Cola 1.5L',
          cost_price: 1000,
          cost_price_tax: 190,
          profit_percentage: 30,
          sale_price: 1547,
          stock: 50,
        },
      ],
    };

    const mockCreated = [
      {
        id: '265bf029-7b3b-4ce4-82ee-c61ecba01c71',
        ...bulkDto.items[0],
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(productServiceMock.createBulkLogs!).mockResolvedValue(mockCreated as any);

    const result = await useCase.execute(bulkDto);

    expect(productServiceMock.createBulkLogs).toHaveBeenCalledTimes(1);
    expect(productServiceMock.createBulkLogs).toHaveBeenCalledWith(bulkDto);
    expect(result).toEqual(mockCreated);
  });
});
