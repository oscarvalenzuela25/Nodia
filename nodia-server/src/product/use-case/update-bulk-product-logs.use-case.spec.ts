import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBulkProductLogsUseCase } from './update-bulk-product-logs.use-case.js';
import type { ProductService } from '../product.service.js';
import type { BulkUpdateProductLogDto } from '../dto/bulk-update-product-log.dto.js';

describe('UpdateBulkProductLogsUseCase', () => {
  let useCase: UpdateBulkProductLogsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      updateBulkLogs: vi.fn(),
    };
    useCase = new UpdateBulkProductLogsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.updateBulkLogs with bulkDto and return updated logs', async () => {
    const bulkDto: BulkUpdateProductLogDto = {
      items: [
        {
          id: '265bf029-7b3b-4ce4-82ee-c61ecba01c71',
          sale_price: 2200,
          stock: 60,
        },
      ],
    };

    const mockUpdated = [
      {
        id: '265bf029-7b3b-4ce4-82ee-c61ecba01c71',
        product_id: '1',
        code: 'PROD-001',
        name: 'Coca Cola 1.5L',
        cost_price: 1000,
        cost_price_tax: 190,
        profit_percentage: 30,
        sale_price: 2200,
        stock: 60,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(productServiceMock.updateBulkLogs!).mockResolvedValue(mockUpdated as any);

    const result = await useCase.execute(bulkDto);

    expect(productServiceMock.updateBulkLogs).toHaveBeenCalledTimes(1);
    expect(productServiceMock.updateBulkLogs).toHaveBeenCalledWith(bulkDto);
    expect(result).toEqual(mockUpdated);
  });
});
