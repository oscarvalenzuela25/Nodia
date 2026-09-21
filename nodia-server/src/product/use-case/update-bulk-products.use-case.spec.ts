import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBulkProductsUseCase } from './update-bulk-products.use-case.js';
import type { ProductService } from '../product.service.js';
import type { BulkUpdateProductDto } from '../dto/bulk-update-product.dto.js';

describe('UpdateBulkProductsUseCase', () => {
  let useCase: UpdateBulkProductsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      updateBulkProducts: vi.fn(),
    };
    useCase = new UpdateBulkProductsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.updateBulkProducts with bulkDto and return updated products', async () => {
    const bulkDto: BulkUpdateProductDto = {
      items: [
        {
          id: '1',
          sale_price: 2200,
          stock: 60,
        },
      ],
    };

    const mockUpdated = [
      {
        id: '1',
        business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
        provider_id: '1',
        code: 'PROD-001',
        name: 'Coca Cola 1.5L',
        cost_price: 1000,
        cost_price_tax: 190,
        profit_percentage: 30,
        sale_price: 2200,
        stock: 60,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(productServiceMock.updateBulkProducts!).mockResolvedValue(mockUpdated as any);

    const result = await useCase.execute(bulkDto);

    expect(productServiceMock.updateBulkProducts).toHaveBeenCalledTimes(1);
    expect(productServiceMock.updateBulkProducts).toHaveBeenCalledWith(bulkDto);
    expect(result).toEqual(mockUpdated);
  });
});
