import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBulkProductsUseCase } from './create-bulk-products.use-case.js';
import type { ProductService } from '../product.service.js';
import type { BulkCreateProductDto } from '../dto/bulk-create-product.dto.js';

describe('CreateBulkProductsUseCase', () => {
  let useCase: CreateBulkProductsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      createBulkProducts: vi.fn(),
    };
    useCase = new CreateBulkProductsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.createBulkProducts with bulkDto and return created products', async () => {
    const bulkDto: BulkCreateProductDto = {
      items: [
        {
          business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
          provider_id: '1',
          code: 'PROD-001',
          name: 'Coca Cola 1.5L',
          cost_price: 1000,
          cost_price_tax: 190,
          profit_percentage: 30,
          sale_price: 1547,
          stock: 50,
          is_active: true,
        },
      ],
    };

    const mockCreated = [
      {
        id: '1',
        ...bulkDto.items[0],
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    vi.mocked(productServiceMock.createBulkProducts!).mockResolvedValue(mockCreated as any);

    const result = await useCase.execute(bulkDto);

    expect(productServiceMock.createBulkProducts).toHaveBeenCalledTimes(1);
    expect(productServiceMock.createBulkProducts).toHaveBeenCalledWith(bulkDto);
    expect(result).toEqual(mockCreated);
  });
});
